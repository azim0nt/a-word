import { getTranslation } from './dictionaryService';

export function formatAssessmentWordList(words, language) {
  return words
    .map((word, index) => `${index + 1}. ${word.word} - ${getTranslation(word, language)}`)
    .join('\n');
}

export async function copyAssessmentWordList(words, language) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Text copying is not supported in this browser.');
  }

  await navigator.clipboard.writeText(formatAssessmentWordList(words, language));
}
