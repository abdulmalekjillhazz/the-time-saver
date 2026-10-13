import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lesson } from '../../src/models/Lesson.js';
import { generateLessonDraftsWithGemini } from '../../src/services/geminiLessons.js';

function generatedLesson(overrides = {}) {
  return {
    slug: 'steady-morning-routine',
    title: { bn: 'সকালের রুটিন', en: 'A steady morning routine' },
    body: {
      bn: [
        '[Storyteller]: আজ পরিবারটি ছোট একটি অভ্যাস নিয়ে কথা বলছে।',
        '[Rahim - Father]: আজ আমরা একটি ছোট অভ্যাস বেছে নেব।',
        '[Asha - Mother]: আমরা একে অপরকে সাহায্য করব।',
        '[Storyteller]: তারা একসঙ্গে পরিকল্পনাটি ঠিক করে।',
        '[Rafi - Child]: আমি এখনই শুরু করতে পারি।',
        '[Storyteller]: এবার তারা কাজটি শুরু করতে প্রস্তুত।',
      ].join('\n'),
      en: [
        '[Storyteller]: The family is discussing one small habit.',
        '[Rahim - Father]: Today we will choose one small habit.',
        '[Asha - Mother]: We can help each other.',
        '[Storyteller]: Together, they agree on a simple plan.',
        '[Rafi - Child]: I can start now.',
        '[Storyteller]: They are ready to begin with that step.',
      ].join('\n'),
    },
    vocabulary: [],
    quiz: [0, 1, 2].map((index) => ({
      question: { bn: `প্রশ্ন ${index + 1} কী?`, en: `What is question ${index + 1}?` },
      options: [
        { bn: 'ছোট অভ্যাস', en: 'A small habit' },
        { bn: 'অনেক কাজ', en: 'Many tasks' },
        { bn: 'কোনোটিই নয়', en: 'None' },
        { bn: 'সব একসাথে', en: 'Everything at once' },
      ],
      answerIndex: 0,
    })),
    ...overrides,
  };
}

describe('Gemini lesson drafts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requires server-side Gemini configuration', async () => {
    await expect(generateLessonDraftsWithGemini({}, { _id: 'owner-id' }, 12)).rejects.toMatchObject({
      status: 503,
      code: 'UNAVAILABLE',
    });
  });

  it('validates generated bilingual quizzes and stores them as owner-attributed drafts', async () => {
    vi.spyOn(Lesson, 'distinct').mockResolvedValue(['existing-lesson']);
    vi.spyOn(Lesson, 'insertMany').mockImplementation(async (drafts) => drafts);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify([generatedLesson()]) }] } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const created = await generateLessonDraftsWithGemini(
      { GEMINI_API_KEY: 'test-only-key', GEMINI_MODEL: 'gemini-2.5-flash' },
      { _id: 'owner-id' },
      1
    );

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ slug: 'steady-morning-routine', aiDrafted: true, createdBy: 'owner-id' });
    expect(fetchMock.mock.calls[0][0].searchParams.get('key')).toBe('test-only-key');
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.contents[0].parts[0].text).toContain('existing-lesson');
    expect(requestBody.contents[0].parts[0].text).not.toContain('owner-id');
    expect(requestBody.generationConfig.maxOutputTokens).toBe(8192);
  });

  it('rejects invalid generated lesson content without saving it', async () => {
    vi.spyOn(Lesson, 'distinct').mockResolvedValue([]);
    const insertMany = vi.spyOn(Lesson, 'insertMany');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify([generatedLesson({ quiz: [] })]) }] } }],
    }), { status: 200 })));

    await expect(generateLessonDraftsWithGemini(
      { GEMINI_API_KEY: 'test-only-key' },
      { _id: 'owner-id' },
      1
    )).rejects.toMatchObject({ status: 502, code: 'UPSTREAM_UNAVAILABLE' });
    expect(insertMany).not.toHaveBeenCalled();
  });

  it('rejects a draft unless both stories use all four required voice tags and storyteller framing', async () => {
    vi.spyOn(Lesson, 'distinct').mockResolvedValue([]);
    const insertMany = vi.spyOn(Lesson, 'insertMany');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify([generatedLesson({
        body: { bn: 'অসম্পূর্ণ গল্প।', en: 'An untagged story.' },
      })]) }] } }],
    }), { status: 200 })));

    await expect(generateLessonDraftsWithGemini(
      { GEMINI_API_KEY: 'test-only-key' },
      { _id: 'owner-id' },
      1
    )).rejects.toMatchObject({ status: 502, code: 'UPSTREAM_UNAVAILABLE' });
    expect(insertMany).not.toHaveBeenCalled();
  });
});
