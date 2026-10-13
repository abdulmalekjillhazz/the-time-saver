import { describe, expect, it } from 'vitest';
import { answerWithLocalModel } from '../lib/localAssistant.js';

const model = { version: 'real-v1' };
const predictions = [
  { title: 'Study', probability: 0.81 },
  { title: 'Walk', probability: 0.42 },
];

describe('local-first assistant', () => {
  it('answers supported risk questions from local predictions in Bengali', () => {
    const answer = answerWithLocalModel('আজ কোন রুটিন মিস হওয়ার ঝুঁকি বেশি?', predictions, model, 'bn');
    expect(answer).toContain('Study: 81%');
  });

  it('answers supported risk questions from local predictions in English', () => {
    const answer = answerWithLocalModel('Which routine has the highest miss risk?', predictions, model, 'en');
    expect(answer).toContain('Study: 81%');
  });

  it('clearly labels synthetic demo estimates as illustrative in both languages', () => {
    const demoModel = { version: 'v1.0.0-candidate', demo: true };
    expect(answerWithLocalModel('miss risk', predictions, demoModel, 'en')).toContain('Illustrative demo only—not validated');
    expect(answerWithLocalModel('মিস ঝুঁকি', predictions, demoModel, 'bn')).toContain('শুধু ডেমো অনুমান—যাচাইকৃত নয়');
  });

  it('leaves unsupported questions or missing active models unanswered locally', () => {
    expect(answerWithLocalModel('Help me plan tomorrow', predictions, model, 'en')).toBeNull();
    expect(answerWithLocalModel('What is my miss risk?', predictions, null, 'en')).toBeNull();
  });

  it('explains locally when there are no routines to evaluate', () => {
    expect(answerWithLocalModel('miss risk', [], model, 'en')).toContain('no routines');
  });

  it('greets in the selected language without relying on a risk model', () => {
    expect(answerWithLocalModel('Hello!', [], null, 'en')).toContain('Smart Routine');
    expect(answerWithLocalModel('হ্যালো', [], null, 'bn')).toContain('Smart Routine');
  });

  it('answers common product questions locally in English and Bengali', () => {
    expect(answerWithLocalModel('What can I do in Smart Routine?', [], null, 'en')).toContain('focus stopwatch');
    expect(answerWithLocalModel('এই অ্যাপে কী করা যায়?', [], null, 'bn')).toContain('রুটিন সাজানো');
  });

  it('explains the remote-provider flow and local fallback accurately', () => {
    const answer = answerWithLocalModel('Do you send my routines to Gemini?', [], null, 'en');
    expect(answer).toContain('normally sends your question and routine summaries to the server');
    expect(answer).toContain('tries Gemini and then Groq');
    expect(answer).toContain('Local keyword matching is only a fallback');
    expect(answer).toContain('not currently active');
  });

  it('states assistant limitations and leaves unrelated questions unanswered', () => {
    expect(answerWithLocalModel('Can you give medical advice?', [], null, 'en')).toContain('not a general-purpose chatbot');
    expect(answerWithLocalModel('Help me plan tomorrow', predictions, model, 'en')).toBeNull();
  });
});
