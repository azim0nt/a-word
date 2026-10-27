import { describe, expect, it } from 'vitest';
import {
  createAssessment,
  finishAssessment,
  formatAssessmentDuration,
  getAssessmentStats,
  updateAssessmentWord,
} from './assessmentService';

const words = [
  { id: 'one', word: 'apple', russian: 'яблоко', uzbek: 'olma' },
  { id: 'two', word: 'book', russian: 'книга', uzbek: 'kitob' },
  { id: 'three', word: 'water', russian: 'вода', uzbek: 'suv' },
];

describe('teacher assessment service', () => {
  it('creates an independent session and calculates accuracy excluding skipped words', () => {
    const session = createAssessment({
      levelId: 'A1',
      moduleTitle: 'Module 1a',
      language: 'Russian',
      words,
      now: 100,
    });
    const scored = updateAssessmentWord(
      updateAssessmentWord(
        updateAssessmentWord(session, 0, 'incorrect'),
        0,
        'correct',
      ),
      1,
      'skipped',
    );
    const stats = getAssessmentStats(scored);

    expect(scored.words[0].status).toBe('correct');
    expect(stats).toEqual({ correct: 1, incorrect: 0, skipped: 1, total: 3, accuracy: 100 });
    expect(getAssessmentStats(session).accuracy).toBe(0);
    expect(getAssessmentStats(session).skipped).toBe(0);
  });

  it('marks unfinished words as skipped when a session ends without evaluated answers', () => {
    const session = createAssessment({
      levelId: 'A1',
      moduleTitle: 'Module 1a',
      language: 'Uzbek',
      words,
    });
    const finished = finishAssessment(session, 200);

    expect(finished.finishedAt).toBe(200);
    expect(finished.words.every((word) => word.status === 'skipped')).toBe(true);
    expect(getAssessmentStats(finished)).toEqual({
      correct: 0,
      incorrect: 0,
      skipped: 3,
      total: 3,
      accuracy: 0,
    });
  });

  it('formats elapsed time for short and long sessions', () => {
    expect(formatAssessmentDuration(65_000)).toBe('1 min 5 sec');
    expect(formatAssessmentDuration(3_661_000)).toBe('1 hr 1 min');
  });
});
