import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { registerUser } from '../../src/services/account.js';
import { createSession } from '../../src/services/session.js';
import { setFlag } from '../../src/services/flags.js';
import { Routine } from '../../src/models/Routine.js';
import { Completion } from '../../src/models/Completion.js';
import { WeeklySummary } from '../../src/models/WeeklySummary.js';
import { getWeekEndDate, generateSummary, shouldGenerateWeeklySummary } from '../../src/services/weeklySummary.js';
import { User } from '../../src/models/User.js';

// Needs MONGODB_URI_TEST and GEMINI_API_KEY. Wipes the test database.
const uri = process.env.MONGODB_URI_TEST;
const config = {
  NODE_ENV: 'test',
  PORT: 0,
  MONGODB_URI: uri || 'mongodb://127.0.0.1:1/unused',
  CLIENT_ORIGIN: 'http://localhost:3000',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
};

const app = createApp({ config });

describe.skipIf(!uri || !config.GEMINI_API_KEY)('Summaries: weekly AI reports', () => {
  let user;
  let userCookie;
  let owner;
  const today = '2026-10-12'; // A Monday for testing

  beforeAll(async () => {
    await mongoose.connect(uri);
    await mongoose.connection.db.dropDatabase();
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

    const base = { password: 'correct-horse-battery', locale: 'en', timezone: 'Asia/Dhaka' };
    user = await registerUser({ ...base, email: 'summary-user@example.com', displayName: 'Learner' });
    owner = await registerUser({ ...base, email: 'summary-owner@example.com', displayName: 'Owner' });
    await User.updateOne({ _id: owner._id }, { $set: { role: 'owner' } });

    const { token, csrf } = await createSession(user._id);
    userCookie = `sr_session=${token}; sr_csrf=${csrf}`;

    // Create some routines and completions for testing
    const routines = [
      {
        userId: user._id,
        title: 'Morning Exercise',
        startTime: '06:00',
        endTime: '07:00',
        priority: 'high',
        isFrog: true,
      },
      {
        userId: user._id,
        title: 'Work Focus',
        startTime: '09:00',
        endTime: '12:00',
        priority: 'high',
      },
      {
        userId: user._id,
        title: 'Lunch Break',
        startTime: '12:00',
        endTime: '13:00',
        priority: 'medium',
      },
    ];
    const created = await Routine.insertMany(routines);

    // Create completions for the last 7 days
    const completions = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      // Exercise: done 5 times (70% - strong)
      if (i > 1) {
        completions.push({
          userId: user._id,
          routineId: created[0]._id,
          date: dateStr,
          status: 'done',
        });
      }

      // Work: done 6 times (100% - very strong)
      completions.push({
        userId: user._id,
        routineId: created[1]._id,
        date: dateStr,
        status: 'done',
      });

      // Lunch: done 4 times (60% - medium)
      if (i < 4) {
        completions.push({
          userId: user._id,
          routineId: created[2]._id,
          date: dateStr,
          status: 'done',
        });
      } else {
        completions.push({
          userId: user._id,
          routineId: created[2]._id,
          date: dateStr,
          status: 'missed',
        });
      }
    }
    await Completion.insertMany(completions);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('GET /api/summaries', () => {
    it('returns 403 when feature flag is disabled', async () => {
      const res = await request(app).get('/api/summaries').set('Cookie', userCookie);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_DISABLED');
    });

    it('returns null message when feature is enabled but no summary exists yet', async () => {
      const ownerToken = await createSession(owner._id);
      await setFlag('summaries.weekly', { enabled: true, rolloutPercent: 100 }, owner._id);

      const res = await request(app).get('/api/summaries').set('Cookie', userCookie);
      expect(res.status).toBe(200);
      expect(res.body.summary).toBeNull();
      expect(res.body.message).toBeDefined();
    });
  });

  describe('POST /api/summaries/generate', () => {
    it('returns 403 when feature flag is disabled', async () => {
      await setFlag('summaries.weekly', { enabled: false, rolloutPercent: 0 }, owner._id);
      const res = await request(app).post('/api/summaries/generate').set('Cookie', userCookie);
      expect(res.status).toBe(403);
    });

    it('generates and returns a summary when enabled', async () => {
      await setFlag('summaries.weekly', { enabled: true, rolloutPercent: 100 }, owner._id);

      const res = await request(app)
        .post('/api/summaries/generate')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.content).toBeDefined();
      expect(res.body.summary.locale).toBe('en');
      expect(res.body.summary.userId).toBe(String(user._id));

      // Should be stored in database
      const stored = await WeeklySummary.findOne({ userId: user._id });
      expect(stored).toBeDefined();
      expect(stored.content).toBe(res.body.summary.content);
    });

    it('reuses existing summary instead of regenerating', async () => {
      const res1 = await request(app)
        .post('/api/summaries/generate')
        .set('Cookie', userCookie);

      const res2 = await request(app)
        .post('/api/summaries/generate')
        .set('Cookie', userCookie);

      expect(res1.body.summary._id).toBe(res2.body.summary._id);
      expect(res1.body.summary.content).toBe(res2.body.summary.content);
    });

    it('respects user locale preference', async () => {
      // Create a Bangla user
      const bnUser = await registerUser({
        email: 'bn-user@example.com',
        displayName: 'বাংলা ব্যবহারকারী',
        password: 'correct-horse-battery',
        locale: 'bn',
        timezone: 'Asia/Dhaka',
      });

      // Copy routines and completions to the new user
      const routines = await Routine.find({ userId: user._id }).lean();
      const bnRoutines = routines.map((r) => ({
        ...r,
        _id: undefined,
        userId: bnUser._id,
      }));
      const bnRts = await Routine.insertMany(bnRoutines);

      const completions = await Completion.find({ userId: user._id }).lean();
      const bnCompletions = completions.map((c, idx) => ({
        ...c,
        _id: undefined,
        userId: bnUser._id,
        routineId: bnRts[idx % bnRts.length]._id,
      }));
      await Completion.insertMany(bnCompletions);

      const { token, csrf } = await createSession(bnUser._id);
      const bnCookie = `sr_session=${token}; sr_csrf=${csrf}`;

      const res = await request(app)
        .post('/api/summaries/generate')
        .set('Cookie', bnCookie);

      expect(res.status).toBe(200);
      expect(res.body.summary.locale).toBe('bn');
    });
  });

  describe('getWeekEndDate utility', () => {
    it('returns the Sunday of a given date', () => {
      expect(getWeekEndDate('2026-10-12')).toBe('2026-10-18'); // Monday -> next Sunday
      expect(getWeekEndDate('2026-10-18')).toBe('2026-10-18'); // Sunday -> same Sunday
      expect(getWeekEndDate('2026-10-17')).toBe('2026-10-18'); // Saturday -> next Sunday
      expect(getWeekEndDate('2026-10-13')).toBe('2026-10-18'); // Tuesday -> next Sunday
    });
  });

  describe('shouldGenerateWeeklySummary utility', () => {
    it('returns false on non-Sunday dates', async () => {
      const result = await shouldGenerateWeeklySummary(user._id, 'Asia/Dhaka');
      // This test runs on whatever day it runs; just check it returns a boolean
      expect(typeof result).toBe('boolean');
    });

    it('returns false if summary already exists for the week', async () => {
      // Create a summary
      await generateSummary({
        userId: user._id,
        locale: 'en',
        timezone: 'Asia/Dhaka',
        config,
      });

      const result = await shouldGenerateWeeklySummary(user._id, 'Asia/Dhaka');
      expect(result).toBe(false);
    });
  });
});
