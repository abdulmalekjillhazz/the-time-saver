import { describe, expect, it } from 'vitest';
import { routineReminderPayload } from '../../src/services/scheduler.js';

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
