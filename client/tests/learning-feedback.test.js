import { afterEach, describe, expect, it, vi } from 'vitest';
import { announceLearningActivity } from '../lib/learningFeedback.js';

afterEach(() => vi.unstubAllGlobals());

describe('learning points feedback', () => {
  it('announces learning activity and awarded points separately', () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal('CustomEvent', class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    });

    announceLearningActivity(20);

    expect(dispatchEvent.mock.calls.map(([event]) => [event.type, event.detail])).toEqual([
      ['smart-routine:learning-activity', { earnedPoints: 20 }],
      ['smart-routine:points-awarded', { points: 20 }],
    ]);
  });

  it('does not show an award for zero or invalid points', () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal('CustomEvent', class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    });

    announceLearningActivity(0);
    announceLearningActivity(Number.NaN);

    expect(dispatchEvent.mock.calls.map(([event]) => event.type)).toEqual([
      'smart-routine:learning-activity',
      'smart-routine:learning-activity',
    ]);
  });
});
