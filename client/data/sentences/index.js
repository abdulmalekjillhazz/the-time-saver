import { BASIC_SENTENCES } from './basic.js';
import { INTERMEDIATE_SENTENCES } from './intermediate.js';
import { ADVANCED_SENTENCES } from './advanced.js';

export { BASIC_SENTENCES } from './basic.js';
export { INTERMEDIATE_SENTENCES } from './intermediate.js';
export { ADVANCED_SENTENCES } from './advanced.js';

export const CORE_SENTENCES = [
  ...BASIC_SENTENCES.map((item) => ({ level: 'basic', ...item })),
  ...INTERMEDIATE_SENTENCES.map((item) => ({ level: 'intermediate', ...item })),
  ...ADVANCED_SENTENCES.map((item) => ({ level: 'advanced', ...item })),
];

