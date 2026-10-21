import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  generateAdminDailyLessonAudio,
  getSeasonBangladesh,
  getStoryTypeForDate,
  getThemeForDate,
  formatDailyLessonForLearner,
  MASTER_PROMPT,
  parseAndValidateDailyLessonPayload,
  formatQuizForLearner,
} from '../../src/services/dailyLesson.js';
import { DailyLesson } from '../../src/models/DailyLesson.js';
import { createCuratedDailyLesson } from '../../src/services/dailyLessonFallback.js';
import { getNarrationVoiceConfigVersion } from '../../src/services/elevenLabs.js';
import { dailyLessonPayloadSchema, routineCreateSchema } from '@smart-routine/shared';

afterEach(() => vi.restoreAllMocks());

describe('Daily Lesson: pure utilities and validation', () => {
  it('instructs the daily story generator to write short, funny beginner stories', () => {
    expect(MASTER_PROMPT).toContain('90-120 spoken words');
    expect(MASTER_PROMPT).toContain('common beginner-level words throughout');
    expect(MASTER_PROMPT).toContain('3 story sentences of 3-5 words, 3 of 6-9 words, and 3 of 10-14 words');
    expect(MASTER_PROMPT).toContain('genuinely amusing and warm');
    expect(MASTER_PROMPT).toContain('keep every event, reaction, and solution plausible');
    expect(MASTER_PROMPT).toContain('clear, fair multiple-choice questions');
  });

  it('serves an existing saved audio URL even when it uses an older voice config', () => {
    const lesson = {
      audio: {
        status: 'ready',
        url: 'https://media.example/old-single-voice.mp3',
        voiceConfigVersion: 'eleven_v3:old-voice-ids',
      },
    };
    expect(formatDailyLessonForLearner(lesson).audio).toEqual({
      status: 'ready',
      url: 'https://media.example/old-single-voice.mp3',
      durationSeconds: undefined,
    });
  });

  it('keeps a saved Cloudinary URL playable while narration is being refreshed', () => {
    const lesson = {
      audio: {
        status: 'processing',
        url: 'https://media.example/already-uploaded.mp3',
        durationSeconds: 42,
      },
    };
    expect(formatDailyLessonForLearner(lesson).audio).toEqual({
      status: 'ready',
      url: 'https://media.example/already-uploaded.mp3',
      durationSeconds: 42,
    });
  });

  it('reuses saved narration without claiming a new generation', async () => {
    const saved = {
      _id: 'lesson-id',
      audio: {
        status: 'ready',
        url: 'https://media.example/story.mp3',
        voiceConfigVersion: getNarrationVoiceConfigVersion({
          ELEVENLABS_MODEL: 'eleven_v3',
          ELEVENLABS_FATHER_VOICE_ID: 'father-voice',
          ELEVENLABS_MOTHER_VOICE_ID: 'mother-voice',
          ELEVENLABS_SON_VOICE_ID: 'son-voice',
          ELEVENLABS_STORYTELLER_VOICE_ID: 'storyteller-voice',
          ELEVENLABS_STABILITY: 0.5,
          ELEVENLABS_SIMILARITY_BOOST: 0.75,
          ELEVENLABS_OUTPUT_FORMAT: 'mp3_44100_128',
        }),
      },
    };
    vi.spyOn(DailyLesson, 'findById').mockResolvedValue(saved);
    const claim = vi.spyOn(DailyLesson, 'findOneAndUpdate');

    const result = await generateAdminDailyLessonAudio('lesson-id', {
      ELEVENLABS_API_KEY: 'test',
      ELEVENLABS_MODEL: 'eleven_v3',
      ELEVENLABS_FATHER_VOICE_ID: 'father-voice',
      ELEVENLABS_MOTHER_VOICE_ID: 'mother-voice',
      ELEVENLABS_SON_VOICE_ID: 'son-voice',
      ELEVENLABS_STORYTELLER_VOICE_ID: 'storyteller-voice',
      ELEVENLABS_STABILITY: 0.5,
      ELEVENLABS_SIMILARITY_BOOST: 0.75,
      ELEVENLABS_OUTPUT_FORMAT: 'mp3_44100_128',
      CLOUDINARY_CLOUD_NAME: 'test',
      CLOUDINARY_API_KEY: 'test',
      CLOUDINARY_API_SECRET: 'test',
    });

    expect(result).toEqual({ lesson: saved, reused: true });
    expect(claim).not.toHaveBeenCalled();
  });

  it('does not start a second narration while one is processing', async () => {
    vi.spyOn(DailyLesson, 'findById').mockResolvedValue({
      _id: 'lesson-id',
      audio: { status: 'processing', updatedAt: new Date() },
    });
    const claim = vi.spyOn(DailyLesson, 'findOneAndUpdate');

    await expect(generateAdminDailyLessonAudio('lesson-id', {
      ELEVENLABS_API_KEY: 'test',
      ELEVENLABS_MODEL: 'eleven_v3',
      ELEVENLABS_FATHER_VOICE_ID: 'father-voice',
      ELEVENLABS_MOTHER_VOICE_ID: 'mother-voice',
      ELEVENLABS_SON_VOICE_ID: 'son-voice',
      ELEVENLABS_STORYTELLER_VOICE_ID: 'storyteller-voice',
      CLOUDINARY_CLOUD_NAME: 'test',
      CLOUDINARY_API_KEY: 'test',
      CLOUDINARY_API_SECRET: 'test',
    })).rejects.toMatchObject({ status: 409 });
    expect(claim).not.toHaveBeenCalled();
  });

  it('provides schema-valid Bengali and English curated fallback stories with three keyed questions', () => {
    for (const locale of ['bn', 'en']) {
      const fallback = createCuratedDailyLesson('2026-10-12', locale);
      expect(dailyLessonPayloadSchema.parse(fallback)).toEqual(fallback);
      expect(fallback.quiz.questions).toHaveLength(3);
      expect(fallback.quiz.questions.every((question) => question.options.filter((option) => option.correct).length === 1)).toBe(true);
    }
  });

  it('accepts an optional atomic habit-stacking anchor', () => {
    const result = routineCreateSchema.parse({
      title: 'Read for five minutes',
      startTime: '08:00',
      endTime: '08:05',
      anchorHabit: 'After breakfast',
    });
    expect(result.anchorHabit).toBe('After breakfast');
  });

  describe('getSeasonBangladesh', () => {
    it('maps winter months correctly (Dec, Jan, Feb)', () => {
      expect(getSeasonBangladesh('2026-12-15')).toBe('winter');
      expect(getSeasonBangladesh('2026-01-10')).toBe('winter');
      expect(getSeasonBangladesh('2026-02-28')).toBe('winter');
    });

    it('maps spring months correctly (Mar, Apr, May)', () => {
      expect(getSeasonBangladesh('2026-03-01')).toBe('spring');
      expect(getSeasonBangladesh('2026-04-14')).toBe('spring');
      expect(getSeasonBangladesh('2026-05-31')).toBe('spring');
    });

    it('maps summer months correctly (Jun, Jul, Aug)', () => {
      expect(getSeasonBangladesh('2026-06-01')).toBe('summer');
      expect(getSeasonBangladesh('2026-07-20')).toBe('summer');
      expect(getSeasonBangladesh('2026-08-31')).toBe('summer');
    });

    it('maps monsoon / transition months correctly (Sep, Oct, Nov)', () => {
      expect(getSeasonBangladesh('2026-09-01')).toBe('monsoon');
      expect(getSeasonBangladesh('2026-10-12')).toBe('monsoon');
      expect(getSeasonBangladesh('2026-11-30')).toBe('monsoon');
    });
  });

  describe('getStoryTypeForDate', () => {
    it('returns personal story for Mondays and Tuesdays (Day 1-2)', () => {
      expect(getStoryTypeForDate('2026-10-12')).toBe('personal');
      expect(getStoryTypeForDate('2026-10-13')).toBe('personal');
    });

    it('returns science explainer for Wednesdays and Thursdays (Day 3-4)', () => {
      expect(getStoryTypeForDate('2026-10-14')).toBe('science');
      expect(getStoryTypeForDate('2026-10-15')).toBe('science');
    });

    it('returns myth-buster for Fridays (Day 5)', () => {
      expect(getStoryTypeForDate('2026-10-16')).toBe('myth');
    });

    it('returns tool/technique for Saturdays and Sundays (Day 6-7)', () => {
      expect(getStoryTypeForDate('2026-10-17')).toBe('tool');
      expect(getStoryTypeForDate('2026-10-18')).toBe('tool');
    });
  });

  describe('getThemeForDate', () => {
    it('returns one of the 5 canonical themes in rotation', () => {
      const canonical = [
        'Sleep & Recovery',
        'Focus & Deep Work',
        'Health & Energy',
        'Relationships & Social Habits',
        'Learning & Growth',
      ];
      const theme = getThemeForDate('2026-10-12');
      expect(canonical).toContain(theme);
    });
  });

  describe('formatQuizForLearner', () => {
    it('strips correct answer indicators to protect quiz integrity', () => {
      const rawQuiz = {
        _id: 'quiz-id-123',
        dailyLessonId: 'lesson-id-456',
        lessonSlug: 'focus-routine',
        questions: [
          {
            text: 'What should you do first?',
            options: [
              { text: 'Start with 5 minutes', correct: true },
              { text: 'Give up', correct: false },
              { text: 'Wait for next year', correct: false },
              { text: 'Buy expensive equipment', correct: false },
            ],
            explanation: 'Small habits compound over time.',
          },
        ],
      };

      const formatted = formatQuizForLearner(rawQuiz);
      expect(formatted._id).toBe('quiz-id-123');
      expect(formatted.questions[0].options[0]).toEqual({ text: 'Start with 5 minutes' });
      expect(formatted.questions[0].options[0].correct).toBeUndefined();
      expect(formatted.questions[0].explanation).toBeUndefined();
    });
  });

  describe('parseAndValidateDailyLessonPayload', () => {
    const validJson = JSON.stringify({
      lesson: {
        slug: 'sleep-first-productivity',
        title: 'Sleep First, Productivity Later',
        description: 'Protecting sleep creates the foundation for every other daily routine.',
        content: [
          '[Storyteller]: The family wants a calmer morning.',
          '[Rahim - Father]: Sleep helps us feel ready for the day.',
          '[Asha - Mother]: Let us make a calm bedtime plan.',
          '[Storyteller]: They agree to prepare before bedtime.',
          '[Rafi - Child]: I can put my book beside the bed.',
          '[Storyteller]: The family starts with that one small step.',
        ].join('\n'),
        category: 'sleep',
        locale: 'en',
        storyType: 'personal',
        keyTakeaway: 'Protect sleep first; other routines will follow.',
        vocabulary: [
          { term: 'sleep debt', definition: 'Cumulative deficit of lost sleep.' },
        ],
      },
      quiz: {
        lessonSlug: 'sleep-first-productivity',
        questions: [
          ...['Why does sleep matter?', 'Who suggests a calm bedtime plan?', 'What will Rafi put beside the bed?'].map((text, index) => ({
            text,
            options: [
              { text: 'It helps us feel ready', correct: true },
              { text: 'It wastes productive time', correct: false },
              { text: 'It changes the time zone', correct: false },
              { text: 'It is optional for adults', correct: false },
            ],
            explanation: `The story gives the reason in answer ${index + 1}.`,
          })),
        ],
      },
    });

    it('parses valid payload successfully', () => {
      const parsed = parseAndValidateDailyLessonPayload(validJson);
      expect(parsed.lesson.slug).toBe('sleep-first-productivity');
      expect(parsed.quiz.questions).toHaveLength(3);
    });

    it('accepts new random character names and role tags', () => {
      const varied = JSON.parse(validJson);
      varied.lesson.content = varied.lesson.content
        .replaceAll('Rahim - Father', 'Tariq - Adult Male')
        .replaceAll('Asha - Mother', 'Mina - Adult Female')
        .replaceAll('Rafi - Child', 'Nila - Child')
        .replaceAll('The family', 'The neighbours');
      expect(parseAndValidateDailyLessonPayload(JSON.stringify(varied)).lesson.content)
        .toContain('[Tariq - Adult Male]');
    });

    it('rejects stories above the multi-voice provider character limit', () => {
      const tooLong = JSON.parse(validJson);
      tooLong.lesson.content = tooLong.lesson.content.replace(
        '[Storyteller]: The family starts with that one small step.',
        `[Storyteller]: ${'x'.repeat(2001)}`,
      );
      expect(() => parseAndValidateDailyLessonPayload(JSON.stringify(tooLong))).toThrow(/short English story/);
    });

    it('rejects Bengali story or quiz text so daily output stays English-only', () => {
      const invalid = JSON.parse(validJson);
      invalid.lesson.content = invalid.lesson.content.replace(
        '[Storyteller]: The family wants a calmer morning.',
        '[Storyteller]: The family wants a calmer morning গল্প.',
      );
      expect(() => parseAndValidateDailyLessonPayload(JSON.stringify(invalid))).toThrow();
    });

    it('strips markdown code fences', () => {
      const wrapped = `\`\`\`json\n${validJson}\n\`\`\``;
      const parsed = parseAndValidateDailyLessonPayload(wrapped);
      expect(parsed.lesson.slug).toBe('sleep-first-productivity');
    });

    it('rejects invalid JSON with 502 UPSTREAM_UNAVAILABLE', () => {
      expect(() => parseAndValidateDailyLessonPayload('not-json')).toThrow();
    });

    it('rejects questions without any correct option', () => {
      const invalid = JSON.parse(validJson);
      invalid.quiz.questions[0].options.forEach((opt) => {
        opt.correct = false;
      });
      expect(() => parseAndValidateDailyLessonPayload(JSON.stringify(invalid))).toThrow();
    });
  });
});
