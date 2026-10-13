import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/models/LandingQuiz.js', () => ({
  LandingQuiz: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

import { LandingQuiz } from '../../src/models/LandingQuiz.js';
import {
  DEFAULT_LANDING_QUIZZES,
  listAdminLandingQuizzes,
  listPublicLandingQuizzes,
  saveLandingQuiz,
  submitLandingQuizAnswer,
} from '../../src/services/landingQuizzes.js';

function queryResult(value) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

afterEach(() => vi.clearAllMocks());

describe('landing page quizzes', () => {
  it('serves two practice quizzes by default without revealing their answer keys', async () => {
    LandingQuiz.find.mockReturnValue(queryResult([]));

    const quizzes = await listPublicLandingQuizzes();

    expect(quizzes).toHaveLength(2);
    expect(quizzes.map(({ slot }) => slot)).toEqual([1, 2]);
    expect(quizzes[0]).not.toHaveProperty('correctIndex');
    expect(quizzes[0]).not.toHaveProperty('explanation');
  });

  it('uses admin-published content for its slot but still hides the answer key publicly', async () => {
    const stored = {
      ...DEFAULT_LANDING_QUIZZES[0],
      question: { bn: 'নতুন বাংলা প্রশ্ন', en: 'A new English question' },
      correctIndex: 2,
      explanation: { bn: 'ব্যাখ্যা', en: 'Explanation' },
    };
    LandingQuiz.find.mockReturnValue(queryResult([stored]));

    const quizzes = await listPublicLandingQuizzes();

    expect(quizzes[0].question.en).toBe('A new English question');
    expect(quizzes[0]).not.toHaveProperty('correctIndex');
    expect(quizzes[0]).not.toHaveProperty('explanation');
    expect(quizzes[1].slot).toBe(2);
  });

  it('provides the two editable admin slots including the starter values', async () => {
    LandingQuiz.find.mockReturnValue(queryResult([]));

    const quizzes = await listAdminLandingQuizzes();

    expect(quizzes).toHaveLength(2);
    expect(quizzes.every((quiz) => quiz.isDefault)).toBe(true);
    expect(quizzes[1].correctIndex).toBe(0);
  });

  it('saves an admin quiz directly to its selected published slot', async () => {
    const quiz = {
      slot: 2,
      question: { bn: 'প্রশ্ন', en: 'Question' },
      options: DEFAULT_LANDING_QUIZZES[1].options,
      correctIndex: 1,
      explanation: { bn: 'ব্যাখ্যা', en: 'Explanation' },
      updatedBy: 'admin-id',
    };
    LandingQuiz.findOneAndUpdate.mockReturnValue(queryResult(quiz));

    const saved = await saveLandingQuiz(2, {
      question: quiz.question,
      options: quiz.options,
      correctIndex: quiz.correctIndex,
      explanation: quiz.explanation,
    }, 'admin-id');

    expect(saved.isDefault).toBe(false);
    expect(LandingQuiz.findOneAndUpdate).toHaveBeenCalledWith(
      { slot: 2 },
      expect.objectContaining({
        $set: expect.objectContaining({ correctIndex: 1, updatedBy: 'admin-id' }),
        $setOnInsert: { slot: 2 },
      }),
      expect.objectContaining({ upsert: true, runValidators: true })
    );
  });

  it('checks answer keys on the server and returns a localized explanation', async () => {
    LandingQuiz.findOne.mockReturnValue(queryResult(null));
    const fallback = DEFAULT_LANDING_QUIZZES[0];

    await expect(submitLandingQuizAnswer(1, fallback.correctIndex, 'bn')).resolves.toEqual({
      correct: true,
      correctOption: fallback.options[fallback.correctIndex].bn,
      explanation: fallback.explanation.bn,
    });
    await expect(submitLandingQuizAnswer(1, 1, 'en')).resolves.toMatchObject({
      correct: false,
      explanation: fallback.explanation.en,
    });
  });
});
