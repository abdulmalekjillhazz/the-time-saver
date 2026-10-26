import webpush from 'web-push';
import { PushSubscription } from '../models/PushSubscription.js';

export function configurePush(config) {
  webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);
}

export async function defaultSender(subscription, body, options = {}) {
  return webpush.sendNotification(subscription, body, { TTL: options.ttl ?? 600 });
}

// Sends one payload to every device of a user. Gone subscriptions (404 or 410) are removed.
// Error details (endpoints, payloads) are never logged.
export async function sendToUser(userId, payload, sender = defaultSender, preference = null) {
  const filter = { userId };
  if (preference === 'holidayReminders') filter.holidayReminders = true;
  if (preference === 'routineReminders') filter.routineReminders = { $ne: false };
  if (preference === 'alarmReminders') filter.alarmReminders = { $ne: false };
  const subs = await PushSubscription.find(filter).lean();
  const body = JSON.stringify(payload);
  let delivered = 0;

  for (const sub of subs) {
    try {
      await sender(
        { endpoint: sub.endpoint, keys: sub.keys },
        body,
        { ttl: preference === 'holidayReminders' ? 24 * 60 * 60 : 600 },
      );
      delivered += 1;
      await PushSubscription.updateOne({ _id: sub._id }, { $set: { lastSuccessAt: new Date(), failureCount: 0 } });
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id });
      } else {
        await PushSubscription.updateOne({ _id: sub._id }, { $inc: { failureCount: 1 } });
      }
    }
  }
  return { delivered };
}

export async function broadcastPushNotification(payload, sender = defaultSender) {
  const subs = await PushSubscription.find({}).lean();
  const body = JSON.stringify({
    title: payload.title || 'Smart Routine',
    body: payload.body || '',
    url: payload.url || '/today',
    tag: `smart-routine-broadcast-${Date.now()}`,
    type: 'broadcast',
  });

  let delivered = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await sender(
        { endpoint: sub.endpoint, keys: sub.keys },
        body,
        { ttl: 24 * 60 * 60 },
      );
      delivered += 1;
      await PushSubscription.updateOne({ _id: sub._id }, { $set: { lastSuccessAt: new Date(), failureCount: 0 } });
    } catch (err) {
      failed += 1;
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id });
      } else {
        await PushSubscription.updateOne({ _id: sub._id }, { $inc: { failureCount: 1 } });
      }
    }
  }

  return { totalSubscriptions: subs.length, delivered, failed };
}
