import { describe, expect, it } from 'vitest';
import { buildAssessmentReportLayout } from './assessmentReport';

describe('assessment PNG report source', () => {
  it('includes only summary statistics and a distribution without word-level counts', () => {
    const session = {
      levelId: 'A1',
      moduleTitle: 'Module 1a',
      finishedAt: new Date('2026-10-27T12:00:00Z').getTime(),
      words: [
        { word: 'apple', russian: 'яблоко', uzbek: 'olma', status: 'correct' },
        { word: 'water', russian: 'вода', uzbek: 'suv', status: 'skipped' },
        { word: 'rock & roll', russian: 'рок', uzbek: 'tosh', status: 'incorrect' },
      ],
    };
    const report = buildAssessmentReportLayout(session, {
      total: 3,
      correct: 1,
      incorrect: 1,
      skipped: 1,
      accuracy: 50,
    }, '1 min 5 sec');

    expect(report.title).toBe('A1 · Module 1a');
    expect(report.duration).toBe('1 min 5 sec');
    expect(report.reviewed).toBe(3);
    expect(report.accuracy).toBe(50);
    expect(report.distribution).toEqual({ correct: 1 / 3, incorrect: 1 / 3, skipped: 1 / 3 });
    expect(report).not.toHaveProperty('groups');
    expect(report).not.toHaveProperty('words');
  });
});
