import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { trainNodeModel } from '../../src/services/nodeTrainer.js';

function sampleRows(count = 300) {
  return Array.from({ length: count }, (_, index) => {
    const start = 6 + (index * 7) % 12;
    const priority = ['low', 'medium', 'high'][index % 3];
    const missed = (Math.floor(index / 7) + index % 5) % 2;
    return {
      user_hash: crypto.createHash('sha256').update(String(index)).digest('hex').slice(0, 16),
      day: new Date(Date.UTC(2026, 0, 1 + Math.floor(index / 15))).toISOString().slice(0, 10),
      start_hour: start,
      duration_min: 20 + (index * 13) % 100,
      weekday: index % 7,
      priority,
      missed,
    };
  });
}

describe('Node model trainer', () => {
  it('refuses insufficient consented training rows', () => {
    expect(() => trainNodeModel(sampleRows(199))).toThrow(/at least 200/);
  });

  it('creates a versioned artifact with a strict time holdout and SHA-256', () => {
    const { artifact, bytes, sha256 } = trainNodeModel(sampleRows(), {
      now: new Date('2026-10-10T09:30:00.000Z'),
    });
    expect(artifact.version).toBe('v20261010093000');
    expect(artifact.features).toEqual(['early', 'start_hour', 'duration_min', 'weekday', 'priority_low', 'priority_medium']);
    expect(Date.parse(artifact.trainingWindow.cutoff)).toBeGreaterThan(Date.parse(artifact.trainingWindow.start));
    expect(Date.parse(artifact.trainingWindow.end)).toBeGreaterThanOrEqual(Date.parse(artifact.trainingWindow.cutoff));
    expect(artifact.trainingWindow.trainRows + artifact.trainingWindow.testRows).toBe(300);
    expect(['candidate', 'rejected']).toContain(artifact.status);
    expect(artifact.decision.status).toBe(artifact.status);
    expect(Object.values(artifact.metrics).filter((value) => typeof value === 'number').every(Number.isFinite)).toBe(true);
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(sha256);
  });

  it('refuses raw or malformed identifiers instead of training', () => {
    const rows = sampleRows();
    rows[0].user_hash = 'email@example.com';
    expect(() => trainNodeModel(rows)).toThrow(/invalid row/);
  });
});
