import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { addDays, todayInZone } from '@smart-routine/shared';
import { createApp } from '../../src/app.js';
import { registerUser } from '../../src/services/account.js';
import { createSession } from '../../src/services/session.js';
import { Routine } from '../../src/models/Routine.js';
import { Completion } from '../../src/models/Completion.js';
import { LearningActivity } from '../../src/models/LearningActivity.js';
import { Lesson } from '../../src/models/Lesson.js';
import { StreakFreeze } from '../../src/models/StreakFreeze.js';
import { getGamificationSummary, recordLearningActivity } from '../../src/services/gamification.js';

const uri = process.env.MONGODB_URI_TEST;
const config = {
  NODE_ENV: 'test',
  PORT: 0,
  MONGODB_URI: uri || 'mongodb://127.0.0.1:1/unused',
  CLIENT_ORIGIN: 'http://localhost:3000',
};
const app = createApp({ config });

describe.skipIf(!uri)('Gamification and activity analytics', () => {
  let cookie;
  let csrf;
  let userId;

  beforeAll(async () => {
    await mongoose.connect(uri);
    await mongoose.connection.db.dropDatabase();
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
    const user = await registerUser({
      email: 'gamification@example.com',
      password: 'correct-horse-battery',
      displayName: 'Learner',
      locale: 'en',
      timezone: 'Asia/Dhaka',
    });
    userId = user._id;
    const session = await createSession(user._id);
    cookie = `sr_session=${session.token}; sr_csrf=${session.csrf}`;
    csrf = session.csrf;
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });

  it('awards reflection XP only on the first save for a date', async () => {
    const date = todayInZone('Asia/Dhaka');
    const first = await request(app)
      .post('/api/gamification/reflection')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ mood: 'happy', note: 'First save', date });

    const edit = await request(app)
      .post('/api/gamification/reflection')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ mood: 'neutral', note: 'Edited reflection', date });

    const stats = await request(app)
      .get('/api/gamification/stats')
      .set('Cookie', cookie);

    expect(first.status).toBe(201);
    expect(first.body.earnedXP).toBe(30);
    expect(edit.status).toBe(200);
    expect(edit.body.earnedXP).toBe(0);
    expect(edit.body.reflection.mood).toBe('neutral');
    expect(stats.status).toBe(200);
    expect(stats.body.xp).toBe(30);
  });

  it('awards 30 points once after ten distinct sentences from a published story', async () => {
    const sentences = [
      'Mina walks to school.',
      'Rafi reads a book.',
      'The small dog sleeps.',
      'We eat lunch together.',
      'They play outside after school.',
      'My sister likes funny stories.',
      'The teacher opens the window.',
      'Our family cooks dinner at home.',
      'A bright kite flies above the park.',
      'The children share their snacks with friends.',
    ];
    await Lesson.create({
      slug: 'grammar-score-story',
      status: 'published',
      title: { bn: 'Grammar score story', en: 'Grammar score story' },
      body: { bn: sentences.join(' '), en: sentences.join(' ') },
      createdBy: userId,
    });

    let finalResult;
    for (const sentence of sentences) {
      finalResult = await request(app)
        .post('/api/gamification/grammar-sentences')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrf)
        .send({ sourceSlug: 'grammar-score-story', sentence });
      expect(finalResult.status).toBe(sentence === sentences[9] ? 201 : 200);
    }

    expect(finalResult.body).toMatchObject({
      completedSentences: 10,
      recorded: true,
      earnedPoints: 30,
      milestoneReached: true,
    });

    const duplicate = await request(app)
      .post('/api/gamification/grammar-sentences')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ sourceSlug: 'grammar-score-story', sentence: sentences[0] });
    expect(duplicate.status).toBe(200);
    expect(duplicate.body).toMatchObject({
      completedSentences: 10,
      recorded: false,
      earnedPoints: 0,
    });

    const invalid = await request(app)
      .post('/api/gamification/grammar-sentences')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ sourceSlug: 'grammar-score-story', sentence: 'Mina walk to school.' });
    expect(invalid.status).toBe(404);
  }, 30_000);

  it('stores paired microfallback settings and records fallback completion', async () => {
    const created = await request(app)
      .post('/api/routines')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({
        title: 'Exercise',
        startTime: '06:00',
        endTime: '06:45',
        fallbackDuration: 5,
        fallbackPrompt: 'Do five push-ups',
      });

    expect(created.status).toBe(201);
    expect(created.body.routine.fallbackDuration).toBe(5);
    expect(created.body.routine.fallbackPrompt).toBe('Do five push-ups');

    const date = todayInZone('Asia/Dhaka');
    const completed = await request(app)
      .put('/api/completions')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({ routineId: created.body.routine.id, date, status: 'done', fallbackUsed: true });

    expect(completed.status).toBe(200);
    expect(completed.body.completion.fallbackUsed).toBe(true);
    expect(await Completion.exists({ routineId: created.body.routine.id, date, fallbackUsed: true })).not.toBeNull();
  });

  it('returns an authenticated localized badge summary and completion heatmap', async () => {
    const [badges, heatmap] = await Promise.all([
      request(app).get('/api/badges').set('Cookie', cookie),
      request(app).get('/api/completions/heatmap?days=30').set('Cookie', cookie),
    ]);

    expect(badges.status).toBe(200);
    expect(badges.body.badges.map(({ key }) => key)).toEqual([
      'century-focus',
      'consistent-learner',
      'early-bird',
      'first-learning-day',
      'quiz-master',
    ]);
    expect(badges.body.badges[0].name.bn).toBeTruthy();
    expect(badges.body.stats.totalRoutinesCompleted).toBe(1);
    expect(heatmap.status).toBe(200);
    expect(heatmap.body.days).toHaveLength(30);
    expect(heatmap.body.heatmap).toHaveLength(30);
    expect(heatmap.body.days.at(-1).count).toBe(1);
  });

  it('records point-earning learning streaks and badges separately for each user', async () => {
    const firstLearner = await registerUser({
      email: 'first-learner@example.com',
      password: 'correct-horse-battery',
      displayName: 'First learner',
      locale: 'en',
      timezone: 'Asia/Dhaka',
    });
    const secondLearner = await registerUser({
      email: 'second-learner@example.com',
      password: 'correct-horse-battery',
      displayName: 'Second learner',
      locale: 'en',
      timezone: 'Asia/Dhaka',
    });
    const legacyLearner = await registerUser({
      email: 'legacy-learner@example.com',
      password: 'correct-horse-battery',
      displayName: 'Legacy learner',
      locale: 'en',
      timezone: 'Asia/Dhaka',
    });
    const streakLearner = await registerUser({
      email: 'streak-learner@example.com',
      password: 'correct-horse-battery',
      displayName: 'Streak learner',
      locale: 'en',
      timezone: 'Asia/Dhaka',
    });

    const firstStory = await recordLearningActivity({
      userId: firstLearner._id,
      activityType: 'story',
      contentId: 'daily:first-story',
      points: 50,
      timezone: firstLearner.timezone,
    });
    const duplicateStory = await recordLearningActivity({
      userId: firstLearner._id,
      activityType: 'story',
      contentId: 'daily:first-story',
      points: 50,
      timezone: firstLearner.timezone,
    });
    const firstQuizAttempt = await recordLearningActivity({
      userId: firstLearner._id,
      activityType: 'quiz',
      contentId: 'daily:retake-quiz',
      points: 10,
      timezone: firstLearner.timezone,
    });
    const improvedQuizAttempt = await recordLearningActivity({
      userId: firstLearner._id,
      activityType: 'quiz',
      contentId: 'daily:retake-quiz',
      points: 20,
      timezone: firstLearner.timezone,
    });
    const lowerQuizAttempt = await recordLearningActivity({
      userId: firstLearner._id,
      activityType: 'quiz',
      contentId: 'daily:retake-quiz',
      points: 15,
      timezone: firstLearner.timezone,
    });
    const zeroPointQuiz = await recordLearningActivity({
      userId: secondLearner._id,
      activityType: 'quiz',
      contentId: 'daily:zero-point-quiz',
      points: 0,
      timezone: secondLearner.timezone,
    });
    await LearningActivity.create({
      userId: legacyLearner._id,
      activityType: 'quiz',
      contentId: 'daily:previous-zero-point-quiz',
      points: 0,
      activeDate: todayInZone(legacyLearner.timezone),
    });
    const upgradedLegacyQuiz = await recordLearningActivity({
      userId: legacyLearner._id,
      activityType: 'quiz',
      contentId: 'daily:previous-zero-point-quiz',
      points: 8,
      timezone: legacyLearner.timezone,
    });
    const today = todayInZone(streakLearner.timezone);
    await LearningActivity.insertMany(Array.from({ length: 7 }, (_, index) => {
      const activeDate = addDays(today, index - 6);
      return {
        userId: streakLearner._id,
        activityType: 'story',
        contentId: `daily:streak-story-${activeDate}`,
        points: 50,
        activeDate,
      };
    }));
    const [firstSummary, secondSummary, legacySummary, streakSummary] = await Promise.all([
      getGamificationSummary(firstLearner._id, firstLearner.timezone),
      getGamificationSummary(secondLearner._id, secondLearner.timezone),
      getGamificationSummary(legacyLearner._id, legacyLearner.timezone),
      getGamificationSummary(streakLearner._id, streakLearner.timezone),
    ]);

    expect(firstStory.earnedPoints).toBe(50);
    expect(firstStory.awardedBadges.map(({ badge }) => badge.key)).toContain('first-learning-day');
    expect(duplicateStory.earnedPoints).toBe(0);
    expect(firstQuizAttempt.earnedPoints).toBe(10);
    expect(improvedQuizAttempt.earnedPoints).toBe(10);
    expect(lowerQuizAttempt.earnedPoints).toBe(0);
    expect(zeroPointQuiz.recorded).toBe(false);
    expect(firstSummary.stats.learningStreak).toEqual({ current: 1, longest: 1 });
    expect(firstSummary.stats.totalLearningDays).toBe(1);
    expect(firstSummary.badges.find(({ key }) => key === 'first-learning-day').earned).toBe(true);
    expect(secondSummary.stats.learningStreak).toEqual({ current: 1, longest: 1 });
    expect(secondSummary.stats.totalLearningDays).toBe(1);
    expect(secondSummary.badges.find(({ key }) => key === 'first-learning-day').earned).toBe(true);
    expect(upgradedLegacyQuiz.earnedPoints).toBe(8);
    expect(legacySummary.stats.learningStreak).toEqual({ current: 1, longest: 1 });
    expect(streakSummary.stats.learningStreak).toEqual({ current: 7, longest: 7 });
    expect(streakSummary.badges.find(({ key }) => key === 'consistent-learner').earned).toBe(true);
  });

  it('allows one streak freeze per week and includes protected dates in the streak', async () => {
    const user = await registerUser({
      email: 'freeze@example.com',
      password: 'correct-horse-battery',
      displayName: 'Freeze tester',
      locale: 'en',
      timezone: 'Asia/Dhaka',
    });
    const session = await createSession(user._id);
    const freezeCookie = `sr_session=${session.token}; sr_csrf=${session.csrf}`;
    const today = todayInZone('Asia/Dhaka');
    const yesterday = new Date(`${today}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const protectedDate = yesterday.toISOString().slice(0, 10);
    const first = await request(app)
      .post('/api/completions/streak-freeze')
      .set('Cookie', freezeCookie)
      .set('X-CSRF-Token', session.csrf)
      .send({ date: protectedDate });

    expect(first.status).toBe(201);
    const second = await request(app)
      .post('/api/completions/streak-freeze')
      .set('Cookie', freezeCookie)
      .set('X-CSRF-Token', session.csrf)
      .send({ date: today });
    expect(second.status).toBe(409);
    expect(await StreakFreeze.countDocuments({ userId: user._id })).toBe(1);

    const streak = await request(app).get('/api/completions/streak').set('Cookie', freezeCookie);
    expect(streak.body.streak.current).toBeGreaterThanOrEqual(1);
  });

  it('does not allow a fallback completion when the routine has no fallback settings', async () => {
    const user = await Routine.findOne().select('userId').lean();
    const regularRoutine = await Routine.create({
      userId: user.userId,
      title: 'Read',
      startTime: '20:00',
      endTime: '20:30',
    });
    const response = await request(app)
      .put('/api/completions')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf)
      .send({
        routineId: String(regularRoutine._id),
        date: todayInZone('Asia/Dhaka'),
        status: 'done',
        fallbackUsed: true,
      });

    expect(response.status).toBe(400);
    expect(await Completion.exists({ routineId: regularRoutine._id })).toBeNull();
  });
});
