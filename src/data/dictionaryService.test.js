import { describe, it, expect } from 'vitest';
import { getLevelSummary } from './dictionaryService';
import a1Data from '../../A1.json';
import a2Data from '../../A2.json';

describe('dictionary loader', () => {
  it('loads A1 and A2 dictionaries and counts words correctly', () => {
    const a1 = getLevelSummary(a1Data, 'A1');
    const a2 = getLevelSummary(a2Data, 'A2');

    expect(a1.totalWords).toBeGreaterThan(0);
    expect(a2.totalWords).toBeGreaterThan(0);
    expect(a1.moduleCount).toBeGreaterThan(0);
    expect(a2.moduleCount).toBeGreaterThan(0);
  });
});
