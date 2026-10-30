import { describe, expect, it } from 'vitest';
import { formatAssessmentWordList } from './assessmentWordList';

const words = [
  { word: 'apple', russian: 'яблоко', uzbek: 'olma' },
  { word: 'book', russian: 'книга', uzbek: 'kitob' },
];

describe('assessment word list', () => {
  it('formats words in order with Russian translations', () => {
    expect(formatAssessmentWordList(words, 'Russian')).toBe(
      '1. apple - яблоко\n2. book - книга',
    );
  });

  it('formats words in order with Uzbek translations', () => {
    expect(formatAssessmentWordList(words, 'Uzbek')).toBe(
      '1. apple - olma\n2. book - kitob',
    );
  });
});
