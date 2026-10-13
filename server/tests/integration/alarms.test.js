import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import webpush from 'web-push';
import { createApp } from '../../src/app.js';
import { runAlarmTick, alarmPushPayload } from '../../src/services/scheduler.js';
import { Alarm } from '../../src/models/Alarm.js';
import { PushSubscription } from '../../src/models/PushSubscription.js';
import { SchedulerLease } from '../../src/models/SchedulerLease.js';

// Needs MONGODB_URI_TEST. Wipes that database. Push sender is faked.
const uri = process.env.MONGODB_URI_TEST;
const keys = webpush.generateVAPIDKeys();
const config = {
  NODE_ENV: 'test',
  PORT: 0,
  MONGODB_URI: uri || 'mongodb://127.0.0.1:1/unused',
  CLIENT_ORIGIN: 'http://localhost:3000',
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: 'mailto:test@example.com',
  SCHEDULER_ENABLED: false,
};
const app = createApp({ config });
const PASSWORD = 'correct-horse-battery';

describe.skipIf(!uri)('Phase 4 integration: closed-app alarms', () => {
  let bob;
  let bobCsrf;
  let bobId;

  beforeAll(async () => {
    await mongoose.connect(uri);
    await mongoose.connection.db.dropDatabase();
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

    bob = request.agent(app);
    const c = await bob.get('/api/auth/csrf');
    const r = await bob
      .post('/api/auth/register')
      .set('X-CSRF-Token', c.body.csrfToken)
      .send({ email: 'alarm-bob@example.com', password: PASSWORD, displayName: 'Bob', locale: 'bn', timezone: 'Asia/Dhaka' });
    bobCsrf = r.body.csrfToken;
    bobId = r.body.user?.id || (await mongoose.connection.db.collection('users').findOne({}))._id;

    await bob
      .post('/api/push/subscriptions')
      .set('X-CSRF-Token', bobCsrf)
      .send({ endpoint: 'https://push.example.test/alarm-1', keys: { p256dh: 'p256dh-value-long-enough', auth: 'auth-value' } });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('creates, lists, and validates alarms', async () => {
    const at = Date.now() + 60 * 60 * 1000;
    const created = await bob
      .post('/api/alarms')
      .set('X-CSRF-Token', bobCsrf)
      .send({ clientId: 'a1', at, name: 'ওষুধ', timezone: 'Asia/Dhaka' });
    expect(created.status).toBe(201);
    expect(created.body.alarm).toMatchObject({ clientId: 'a1', at, name: 'ওষুধ' });

    const listed = await bob.get('/api/alarms');
    expect(listed.status).toBe(200);
    expect(listed.body.alarms.map((a) => a.clientId)).toContain('a1');

    const bad = await bob
      .post('/api/alarms')
      .set('X-CSRF-Token', bobCsrf)
      .send({ clientId: '', at: -5, name: 'x', timezone: 'Mars/Olympus' });
    expect(bad.status).toBe(400);

    const anon = await request(app).get('/api/alarms');
    expect(anon.status).toBe(401);
  });

  it('sends a due alarm once with the alarm name, then suppresses the rerun', async () => {
    await SchedulerLease.deleteMany({});
    const at = Date.now() - 30 * 1000;
    await bob.post('/api/alarms').set('X-CSRF-Token', bobCsrf)
      .send({ clientId: 'a2', at, name: 'ফজরের প্রস্তুতি', timezone: 'Asia/Dhaka' });

    const bodies = [];
    const first = await runAlarmTick({ now: new Date(), owner: 'alarm-a', sender: async (_s, b) => { bodies.push(JSON.parse(b)); } });
    expect(first.sent).toBe(1);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].title).toContain('অ্যালার্ম');
    expect(bodies[0].body).toContain('ফজরের প্রস্তুতি');
    expect(bodies[0].tag).toBe('smart-routine-alarm-a2');
    expect(bodies[0].requireInteraction).toBe(true);

    await SchedulerLease.deleteMany({});
    const second = await runAlarmTick({ now: new Date(), owner: 'alarm-b', sender: async () => { throw new Error('duplicate push'); } });
    expect(second.sent).toBe(0);
    expect(second.suppressed).toBe(0);
  });

  it('counts a lost claim race as suppressed instead of sending', async () => {
    await SchedulerLease.deleteMany({});
    await bob.post('/api/alarms').set('X-CSRF-Token', bobCsrf)
      .send({ clientId: 'a2c', at: Date.now() - 10 * 1000, name: 'Race', timezone: 'Asia/Dhaka' });
    // Simulate another server winning the atomic claim a moment earlier.
    const spy = vi.spyOn(Alarm, 'findOneAndUpdate').mockReturnValueOnce({ lean: async () => null });
    const stats = await runAlarmTick({ now: new Date(), owner: 'alarm-race', sender: async () => { throw new Error('must not send'); } });
    expect(stats.suppressed).toBe(1);
    expect(stats.sent).toBe(0);
    spy.mockRestore();
    await Alarm.deleteOne({ clientId: 'a2c' });
  });

  it('reports a page-fired alarm as already fired and skips the push', async () => {
    await SchedulerLease.deleteMany({});
    await bob.post('/api/alarms').set('X-CSRF-Token', bobCsrf)
      .send({ clientId: 'a3', at: Date.now() - 10 * 1000, name: 'Open app rang me', timezone: 'Asia/Dhaka' });
    const fired = await bob.post('/api/alarms/a3/fired').set('X-CSRF-Token', bobCsrf);
    expect(fired.body.alreadyFired).toBe(false);

    const stats = await runAlarmTick({ now: new Date(), owner: 'alarm-c', sender: async () => { throw new Error('duplicate push'); } });
    expect(stats.sent).toBe(0);
  });

  it('lists missed alarms until acknowledged, and re-arms on snooze', async () => {
    const missed = await bob.get('/api/alarms').query({ missed: '1' });
    expect(missed.status).toBe(200);
    expect(missed.body.alarms.map((a) => a.clientId)).toEqual(expect.arrayContaining(['a2', 'a3']));

    const ack = await bob.patch('/api/alarms/a2').set('X-CSRF-Token', bobCsrf).send({ acknowledged: true });
    expect(ack.status).toBe(200);
    const missedAfter = await bob.get('/api/alarms').query({ missed: '1' });
    expect(missedAfter.body.alarms.map((a) => a.clientId)).not.toContain('a2');

    const snoozed = await bob.patch('/api/alarms/a3').set('X-CSRF-Token', bobCsrf).send({ at: Date.now() + 5 * 60 * 1000 });
    expect(snoozed.status).toBe(200);
    expect(snoozed.body.alarm.firedAt).toBeNull();
  });

  it('cancels an alarm so the tick never sends it', async () => {
    await SchedulerLease.deleteMany({});
    await bob.post('/api/alarms').set('X-CSRF-Token', bobCsrf)
      .send({ clientId: 'a4', at: Date.now() - 10 * 1000, name: 'Cancelled', timezone: 'Asia/Dhaka' });
    const del = await bob.delete('/api/alarms/a4').set('X-CSRF-Token', bobCsrf);
    expect(del.body).toEqual({ ok: true });
    const stats = await runAlarmTick({ now: new Date(), owner: 'alarm-d', sender: async () => { throw new Error('cancelled alarm sent'); } });
    expect(stats.sent).toBe(0);
  });

  it('builds an English payload without a name or next routine', () => {
    const payload = alarmPushPayload({ name: '', nextRoutineTitle: '', locale: 'en', clientId: 'x' });
    expect(payload.title).toContain('alarm is ringing');
    expect(payload.actions).toHaveLength(2);
    expect(payload.snoozeUrl).toContain('snooze=x');
  });

  it('skips users who turned alarm push off', async () => {
    await SchedulerLease.deleteMany({});
    await PushSubscription.updateMany({ userId: bobId }, { $set: { alarmReminders: false } });
    await bob.post('/api/alarms').set('X-CSRF-Token', bobCsrf)
      .send({ clientId: 'a5', at: Date.now() - 10 * 1000, name: 'Muted', timezone: 'Asia/Dhaka' });
    let calls = 0;
    const stats = await runAlarmTick({ now: new Date(), owner: 'alarm-e', sender: async () => { calls += 1; } });
    expect(calls).toBe(0);
    expect(stats.sent).toBe(0);
    await PushSubscription.updateMany({ userId: bobId }, { $set: { alarmReminders: true } });
  });
});
