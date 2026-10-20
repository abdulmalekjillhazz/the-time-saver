import { describe, expect, it } from 'vitest';
import {
  routineReminderPayload,
  taskCompletionReminderPayload,
  taskCompletionReminderSlot,
} from '../../src/services/scheduler.js';

describe('routine reminder messages', () => {
  it('explains the reminder trigger in English and Bengali without routine content', () => {
    expect(routineReminderPayload('en')).toEqual({
      title: 'Routine starting soon',
      body: 'Reason: you enabled routine reminders, and a routine has reached its scheduled start time.',
      url: '/app',
    });
    expect(routineReminderPayload('bn')).toEqual({
      title: 'রুটিন শুরু হচ্ছে',
      body: 'কারণ: আপনি রুটিন রিমাইন্ডার চালু করেছেন এবং একটি রুটিনের নির্ধারিত শুরুর সময় হয়েছে।',
      url: '/app',
    });
    expect(routineReminderPayload('en').body).not.toContain('Morning walk');
  });
});

describe('task completion reminder schedule', () => {
  it('selects the morning and evening slots in the user timezone', () => {
    expect(taskCompletionReminderSlot('Asia/Dhaka', new Date('2026-10-20T03:00:00.000Z')))
      .toEqual({ date: '2026-10-20', kind: 'morning' });
    expect(taskCompletionReminderSlot('Asia/Dhaka', new Date('2026-10-20T12:04:00.000Z')))
      .toEqual({ date: '2026-10-20', kind: 'evening' });
    expect(taskCompletionReminderSlot('Asia/Dhaka', new Date('2026-10-20T12:05:00.000Z')))
      .toBeNull();
  });

  it('encourages unfinished tasks and acknowledges completed routines in both languages', () => {
    expect(taskCompletionReminderPayload('en', false)).toMatchObject({
      title: 'Time to finish a routine',
      url: '/app',
    });
    expect(taskCompletionReminderPayload('bn', true)).toMatchObject({
      title: 'আজকের কাজ সম্পন্ন!',
      url: '/app',
    });
  });
});
