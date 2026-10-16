import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import fs from 'node:fs';
import { lessonDraftSchema } from '@smart-routine/shared';
import { createApp } from '../../src/app.js';
import { DailyLesson } from '../../src/models/DailyLesson.js';
import { registerUser } from '../../src/services/account.js';
import { createDraft, submitForReview, publishLesson } from '../../src/services/lessons.js';

// Needs MONGODB_URI_TEST. Wipes that database.
const uri = process.env.MONGODB_URI_TEST;
const config = {
  NODE_ENV: 'test',
  PORT: 0,
  MONGODB_URI: uri || 'mongodb://127.0.0.1:1/unused',
  CLIENT_ORIGIN: 'http://localhost:3000',
};
const app = createApp({ config });
const PASSWORD = 'correct-horse-battery';
const sample = lessonDraftSchema.parse(JSON.parse(fs.readFileSync('scripts/examples/lesson-sample.json', 'utf8')));

describe.skipIf(!uri)('Phase 4 integration: lessons and quizzes', () => {
  let author;
  let reviewer;
  let learner;
  let learnerCsrf;
  let publishedId;

  beforeAll(async () => {
    await mongoose.connect(uri);
    await mongoose.connection.db.dropDatabase();
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    const base = { password: PASSWORD, displayName: 'Editor', locale: 'en', timezone: 'Asia/Dhaka' };
    author = await registerUser({ ...base, email: 'author@example.com' });
    reviewer = await registerUser({ ...base, email: 'reviewer@example.com', displayName: 'Reviewer' });

    learner = request.agent(app);
    const c = await learner.get('/api/auth/csrf');
    const r = await learner
      .post('/api/auth/register')
      .set('X-CSRF-Token', c.body.csrfToken)
      .send({ email: 'learner@example.com', password: PASSWORD, displayName: 'Learner', locale: 'en', timezone: 'Asia/Dhaka' });
    learnerCsrf = r.body.csrfToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('a draft is not visible to learners', async () => {
    await createDraft(author, sample);
    const list = await request(app).get('/api/lessons');
    expect(list.body.lessons).toEqual([]);
    const one = await request(app).get('/api/lessons/morning-plan');
    expect(one.status).toBe(404);
  });

  it('the author cannot publish their own lesson (needs a second person)', async () => {
    await submitForReview('morning-plan', author);
    await expect(publishLesson('morning-plan', author)).rejects.toMatchObject({ status: 403 });
  });

  it('an owner may review and publish their own AI-generated draft', async () => {
    const aiDraft = { ...sample, slug: 'ai-created-lesson', aiDrafted: true };
    await createDraft(author, aiDraft);
    await submitForReview('ai-created-lesson', author);
    await expect(publishLesson('ai-created-lesson', { ...author.toObject(), role: 'editor' })).rejects.toMatchObject({ status: 403 });
    await expect(publishLesson('ai-created-lesson', { ...author.toObject(), role: 'owner' })).resolves.toMatchObject({ status: 'published' });
  });

  it('only the author can submit; a reviewer cannot submit someone else\'s draft', async () => {
    const other = { slug: 'other-lesson', title: sample.title, body: sample.body, vocabulary: [], quiz: [], aiDrafted: false };
    await createDraft(author, other);
    await expect(submitForReview('other-lesson', reviewer)).rejects.toMatchObject({ status: 403 });
  });

  it('a second person publishes; the lesson appears publicly without answers', async () => {
    const published = await publishLesson('morning-plan', reviewer);
    publishedId = String(published._id);

    const list = await request(app).get('/api/lessons');
    expect(list.body.lessons.map((l) => l.slug)).toContain('morning-plan');

    const one = await request(app).get('/api/lessons/morning-plan');
    expect(one.status).toBe(200);
    expect(JSON.stringify(one.body)).not.toContain('answerIndex');
  });

  it('awards story points once and ranks the learner without exposing their email', async () => {
    const firstRead = await learner
      .post(`/api/lessons/${publishedId}/read`)
      .set('X-CSRF-Token', learnerCsrf)
      .send({});
    const repeatedRead = await learner
      .post(`/api/lessons/${publishedId}/read`)
      .set('X-CSRF-Token', learnerCsrf)
      .send({});

    expect(firstRead.status).toBe(201);
    expect(firstRead.body.earnedPoints).toBe(50);
    expect(repeatedRead.body.earnedPoints).toBe(0);
  });

  it('a learner submits answers and the server scores them', async () => {
    const correct = sample.quiz[0].answerIndex;
    const wrong = (correct + 1) % 4;
    const res = await learner
      .post(`/api/lessons/${publishedId}/attempts`)
      .set('X-CSRF-Token', learnerCsrf)
      .send({ answers: [correct] });
    expect(res.status).toBe(201);
    expect(res.body.score).toBe(1);
    expect(res.body.earnedPoints).toBe(30);

    const res2 = await learner
      .post(`/api/lessons/${publishedId}/attempts`)
      .set('X-CSRF-Token', learnerCsrf)
      .send({ answers: [wrong] });
    expect(res2.body.score).toBe(0);
    expect(res2.body.earnedPoints).toBe(0);

    const leaderboard = await learner.get('/api/gamification/leaderboard');
    expect(leaderboard.status).toBe(200);
    expect(leaderboard.body.members[0]).toMatchObject({
      name: 'Learner',
      points: 80,
      activeDays: 1,
      level: 1,
      rank: 1,
      isKing: true,
    });
    expect(JSON.stringify(leaderboard.body)).not.toContain('learner@example.com');
  });

  it('awards story points once when opening a daily lesson from the published lessons list', async () => {
    const leaderboardBeforeRead = await learner.get('/api/gamification/leaderboard');
    const existingPoints = leaderboardBeforeRead.body.members[0]?.points ?? 0;
    const dailyLesson = await DailyLesson.create({
      date: '2026-10-16',
      slug: 'leaderboard-daily-story',
      title: 'A Daily Story',
      description: 'A short daily lesson.',
      content: '[Storyteller]: A short story.',
      category: 'focus',
      locale: 'en',
      storyType: 'personal',
      keyTakeaway: 'Read a little each day.',
    });

    const firstRead = await learner
      .post(`/api/lessons/${dailyLesson._id}/read`)
      .set('X-CSRF-Token', learnerCsrf)
      .send({});
    const repeatedRead = await learner
      .post(`/api/lessons/${dailyLesson._id}/read`)
      .set('X-CSRF-Token', learnerCsrf)
      .send({});

    expect(firstRead.status).toBe(201);
    expect(firstRead.body.earnedPoints).toBe(50);
    expect(repeatedRead.status).toBe(201);
    expect(repeatedRead.body.earnedPoints).toBe(0);

    const leaderboard = await learner.get('/api/gamification/leaderboard');
    expect(leaderboard.body.members[0]).toMatchObject({
      name: 'Learner',
      points: existingPoints + 50,
      activeDays: 1,
      rank: 1,
    });
  });

  it('an answer count that does not match the questions is refused', async () => {
    const res = await learner
      .post(`/api/lessons/${publishedId}/attempts`)
      .set('X-CSRF-Token', learnerCsrf)
      .send({ answers: [0, 1] });
    expect(res.status).toBe(400);
  });

  it('attempts need a login', async () => {
    const res = await request(app)
      .post(`/api/lessons/${publishedId}/attempts`)
      .set('X-CSRF-Token', 'ffffffffffffffffffffffffffffffffffffffffffff')
      .set('Cookie', 'sr_csrf=ffffffffffffffffffffffffffffffffffffffffffff')
      .send({ answers: [0] });
    expect(res.status).toBe(401);
  });

  it('a draft lesson cannot be attempted, even with its id', async () => {
    const draft = await createDraft(author, { ...sample, slug: 'still-draft' });
    const res = await learner
      .post(`/api/lessons/${draft._id}/attempts`)
      .set('X-CSRF-Token', learnerCsrf)
      .send({ answers: [0] });
    expect(res.status).toBe(404);
  });
});
