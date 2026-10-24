import { describe, expect, it } from 'vitest';
import { parseNarrationSpeakerName, parseStoryNarration } from '../src/storyNarration.js';

describe('shared story narration parsing', () => {
  it('normalizes speaker names into the voice roles', () => {
    expect(parseNarrationSpeakerName('Mina - Adult Female')).toBe('mother');
    expect(parseNarrationSpeakerName('Rahim - Father')).toBe('father');
    expect(parseNarrationSpeakerName('গল্পকথক')).toBe('storyteller');
    expect(parseNarrationSpeakerName('Scene')).toBe('narrator');
  });

  it('strips speaker labels so narration and displayed dialogue use matching text', () => {
    const segments = parseStoryNarration([
      '[Scene]: The door opens.',
      '[Mina - Adult Female]: I found the key.',
      '[Tariq - Adult Male]: It was under the book.',
    ].join('\n'));

    expect(segments.map(({ text }) => text)).toEqual([
      'The story begins.',
      'The door opens.',
      'I found the key.',
      'The family talks it through together.',
      'It was under the book.',
      'That is the end of the story.',
    ]);
    expect(segments.map(({ speaker }) => speaker)).toEqual([
      'storyteller',
      'narrator',
      'mother',
      'storyteller',
      'father',
      'storyteller',
    ]);
  });

  it('splits long text into the same-sized chunks the player displays', () => {
    const text = `${'word '.repeat(40).trim()} end.`;
    const segments = parseStoryNarration(`[Storyteller]: ${text}`);
    const dialogueSegments = segments.filter(({ text: segmentText }) => segmentText !== 'The story begins.'
      && segmentText !== 'The family talks it through together.'
      && segmentText !== 'That is the end of the story.');

    expect(dialogueSegments.length).toBeGreaterThan(1);
    expect(dialogueSegments.map(({ text: segmentText }) => segmentText).join(' ')).toBe(text);
    expect(dialogueSegments.every(({ text: segmentText }) => segmentText.length <= 150)).toBe(true);
  });

  it('does not add narration segments when a story already has storyteller lines', () => {
    expect(parseStoryNarration('[Storyteller]: The story begins.').map(({ text }) => text))
      .toEqual(['The story begins.']);
  });

  it('uses the narrator as the default speaker without adding text absent from the display', () => {
    expect(parseStoryNarration('An untagged story line.')).toEqual([
      { speaker: 'storyteller', character: 'Narrator', text: 'An untagged story line.' },
    ]);
  });
});
