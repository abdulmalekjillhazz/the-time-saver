import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { registerUser } from '../../src/services/account.js';
import { createSession } from '../../src/services/session.js';
import { setFlag } from '../../src/services/flags.js';
import { DailyLesson } from '../../src/models/DailyLesson.js';
import { Quiz } from '../../src/models/Quiz.js';
import { DailyQuizScore } from '../../src/models/DailyQuizScore.js';
import { generateDailyLesson } from '../../src/services/dailyLesson.js';
import { User } from '../../src/models/User.js';

const uri = process.env.MONGODB_URI_TEST;
const config = {
  NODE_ENV: 'test',
  PORT: 0,
  MONGODB_URI: uri || 'mongodb://127.0.0.1:1/unused',
  CLIENT_ORIGIN: 'http://localhost:3000',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
};

const app = createApp({ config });

describe.skipIf(!uri || !config.GEMINI_API_KEY)('Daily Lessons & Quizzes: AI Generation and Learning Loop', () => {
  let user;
  let userCookie;
  let csrfToken;
  let owner;
  let ownerCookie;
  let ownerCsrf;
  const testDate = '2026-10-12';

  beforeAll(async () => {
    await mongoose.connect(uri);
    await mongoose.connection.db.dropDatabase();
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

    const base = { password: 'correct-horse-battery', locale: 'en', timezone: 'Asia/Dhaka' };
    user = await registerUser({ ...base, email: 'learner-daily@example.com', displayName: 'Learner' });
    owner = await registerUser({ ...base, email: 'owner-daily@example.com', displayName: 'Owner' });
    await User.updateOne({ _id: owner._id }, { $set: { role: 'owner' } });

    const userSession = await createSession(user._id);
    userCookie = `sr_session=${userSession.token}; sr_csrf=${userSession.csrf}`;
    csrfToken = userSession.csrf;

    const ownerSession = await createSession(owner._id);
    ownerCookie = `sr_session=${ownerSession.token}; sr_csrf=${ownerSession.csrf}`;
    ownerCsrf = ownerSession.csrf;
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
  });

  it('rejects /today endpoint with 403 when lessons.daily flag is disabled', async () => {
    await setFlag('lessons.daily', { enabled: false, rolloutPercent: 0 });

    const res = await request(app)
      .get('/api/lessons/today')
      .set('Cookie', userCookie);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FEATURE_DISABLED');
  });

  it('generates a daily lesson and quiz successfully', async () => {
    await setFlag('lessons.daily', { enabled: true, rolloutPercent: 100 });

    const { dailyLesson, quiz } = await generateDailyLesson({
      date: testDate,
      locale: 'en',
      config,
    });

    expect(dailyLesson).toBeDefined();
    expect(dailyLesson.date).toBe(testDate);
    expect(dailyLesson.slug).toBeDefined();
    expect(quiz).toBeDefined();
    expect(quiz.questions.length).toBeGreaterThanOrEqual(1);

    const savedLesson = await DailyLesson.findOne({ date: testDate, locale: 'en' });
    expect(savedLesson).not.toBeNull();
    const savedQuiz = await Quiz.findOne({ dailyLessonId: savedLesson._id });
    expect(savedQuiz).not.toBeNull();
  });

  it('returns cached daily lesson and sanitized quiz via GET /api/lessons/today', async () => {
    await setFlag('lessons.daily', { enabled: true, rolloutPercent: 100 });

    const res = await request(app)
      .get(`/api/lessons/today?date=${testDate}&locale=en`)
      .set('Cookie', userCookie);

    expect(res.status).toBe(200);
    expect(res.body.dailyLesson).toBeDefined();
    expect(res.body.dailyLesson.date).toBe(testDate);
    expect(res.body.quiz).toBeDefined();
    expect(res.body.quiz.questions[0].options[0].correct).toBeUndefined();
  });

  it('serves latest quiz via GET /api/quizzes/latest', async () => {
    await setFlag('lessons.daily', { enabled: true, rolloutPercent: 100 });

    const res = await request(app)
      .get('/api/quizzes/latest?locale=en')
      .set('Cookie', userCookie);

    expect(res.status).toBe(200);
    expect(res.body.quiz).toBeDefined();
    expect(res.body.lessonSlug).toBeDefined();
  });

  it('scores daily quiz attempt via POST /api/lessons/today/attempts', async () => {
    await setFlag('lessons.daily', { enabled: true, rolloutPercent: 100 });

    const savedQuiz = await Quiz.findOne({ lessonSlug: (await DailyLesson.findOne({ date: testDate, locale: 'en' })).slug });
    const correctIndices = savedQuiz.questions.map((q) => q.options.findIndex((opt) => opt.correct === true));

    const res = await request(app)
      .post('/api/lessons/today/attempts')
      .set('Cookie', userCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ date: testDate, answers: correctIndices });

    expect(res.status).toBe(201);
    expect(res.body.score).toBe(savedQuiz.questions.length);
    expect(res.body.total).toBe(savedQuiz.questions.length);
    expect(res.body.results).toHaveLength(savedQuiz.questions.length);

    const scoreRecord = await DailyQuizScore.findOne({ userId: user._id });
    expect(scoreRecord).not.toBeNull();
    expect(scoreRecord.score).toBe(savedQuiz.questions.length);
  });

  it('ensures idempotency when generateDailyLesson is called twice for same date and locale', async () => {
    const firstCount = await DailyLesson.countDocuments({ date: testDate, locale: 'en' });
    expect(firstCount).toBe(1);

    await generateDailyLesson({
      date: testDate,
      locale: 'en',
      config,
    });

    const secondCount = await DailyLesson.countDocuments({ date: testDate, locale: 'en' });
    expect(secondCount).toBe(1);
  });
});
