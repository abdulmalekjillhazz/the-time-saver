import { afterEach, describe, expect, it, vi } from 'vitest';
import { LearningActivity } from '../../src/models/LearningActivity.js';
import { getGrammarSentenceProgress } from '../../src/services/gamification.js';

afterEach(() => vi.restoreAllMocks());

describe('grammar sentence progress', () => {
  it('returns durable sentence counts grouped by difficulty', async () => {
    const activities = [
      { contentId: 'sentence:morning-walk:mina reads every day.' },
      { contentId: 'sentence:morning-walk:mina reads a useful book every day.' },
      { contentId: 'sentence:brain-breaks:mina reads a useful book every day because she enjoys learning.' },
    ];
    const lean = vi.fn().mockResolvedValue(activities);
    const select = vi.fn().mockReturnValue({ lean });
    const find = vi.spyOn(LearningActivity, 'find').mockReturnValue({ select });

    await expect(getGrammarSentenceProgress('user-id')).resolves.toEqual({
      completedSentences: 3,
      completedLevels: { basic: 1, intermediate: 1, advanced: 1 },
    });
    expect(find).toHaveBeenCalledWith({
      userId: 'user-id',
      activityType: 'grammar',
      contentId: /^sentence:/,
    });
    expect(select).toHaveBeenCalledWith('contentId');
  });
});
