// Brand colours: forest green and gold. Every text pair is checked for WCAG 2.2 AA by scripts/contrast-check.mjs.
export const PALETTE = Object.freeze({
  paper: '#061B12',
  ink: '#F0FDF4',
  sapphire: '#4ADE80',
  sapphireDeep: '#22A95A',
  onSapphire: '#052E16',
  gold: '#F2C14E',
  goldSoft: '#FCE9B0',
  onGold: '#1B1B1F',
  azure: '#7DD3FC',
});

// Pairs that must meet 4.5:1 when used for text.
export const TEXT_PAIRS = Object.freeze([
  ['ink', 'paper'],
  ['sapphire', 'paper'],
  ['sapphireDeep', 'paper'],
  ['azure', 'paper'],
  ['onSapphire', 'sapphire'],
  ['onGold', 'gold'],
  ['onGold', 'goldSoft'],
]);
