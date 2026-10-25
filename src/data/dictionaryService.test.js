import { describe, it, expect } from 'vitest';
import { getLevelSummary } from './dictionaryService';
import a1Data from '../../A1.json';
import a2Data from '../../A2.json';
import b1Data from '../../B1.json';
import b1PlusData from '../../B1+.json';
import b2Data from '../../B2.json';

describe('dictionary loader', () => {
  it('loads A1 and A2 dictionaries and counts words correctly', () => {
    const a1 = getLevelSummary(a1Data, 'A1');
    const a2 = getLevelSummary(a2Data, 'A2');

    expect(a1.totalWords).toBeGreaterThan(0);
    expect(a2.totalWords).toBeGreaterThan(0);
    expect(a1.moduleCount).toBeGreaterThan(0);
    expect(a2.moduleCount).toBeGreaterThan(0);
  });

  it.each([
    ['B1', b1Data, 1311, 18],
    ['B1+', b1PlusData, 1741, 20],
    ['B2', b2Data, 1572, 20],
  ])('loads the %s dictionary from nested module data', (levelId, data, totalWords, moduleCount) => {
    const summary = getLevelSummary(data, levelId);

    expect(summary.valid).toBe(true);
    expect(summary.totalWords).toBe(totalWords);
    expect(summary.moduleCount).toBe(moduleCount);
    expect(summary.modules[0].title).toMatch(/^Module 1 [AB]$/);
    expect(summary.modules[0].words.length).toBeGreaterThan(0);
  });
});
