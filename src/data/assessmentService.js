export const ASSESSMENT_STORAGE_KEY = 'A-Word-assessments-v1';

export function loadAssessmentStore() {
  if (typeof window === 'undefined') {
    return { active: null, sessions: [] };
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(ASSESSMENT_STORAGE_KEY) ?? '{}');
    return {
      active: stored.active?.words?.length ? stored.active : null,
      sessions: Array.isArray(stored.sessions) ? stored.sessions : [],
    };
  } catch {
    return { active: null, sessions: [] };
  }
}

export function saveAssessmentStore(store) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ASSESSMENT_STORAGE_KEY, JSON.stringify(store));
}

export function createAssessment({ levelId, moduleTitle, language, words, now = Date.now() }) {
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    levelId,
    moduleTitle,
    language,
    words: words.map((word) => ({ ...word, status: null })),
    index: 0,
    phase: 'setup',
    startedAt: null,
    finishedAt: null,
  };
}

export function updateAssessmentWord(session, index, status) {
  return {
    ...session,
    words: session.words.map((word, wordIndex) => (
      wordIndex === index ? { ...word, status } : word
    )),
  };
}

export function finishAssessment(session, finishedAt = Date.now()) {
  return {
    ...session,
    phase: 'complete',
    finishedAt,
    words: session.words.map((word) => (
      word.status ? word : { ...word, status: 'skipped' }
    )),
  };
}

export function getAssessmentStats(session) {
  const stats = session.words.reduce((counts, word) => {
    if (word.status === 'correct') counts.correct += 1;
    if (word.status === 'incorrect') counts.incorrect += 1;
    if (word.status === 'skipped') counts.skipped += 1;
    return counts;
  }, { correct: 0, incorrect: 0, skipped: 0 });

  const evaluated = stats.correct + stats.incorrect;
  return {
    ...stats,
    total: session.words.length,
    accuracy: evaluated ? Math.round((stats.correct / evaluated) * 100) : 0,
  };
}

export function formatAssessmentDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours) return `${hours} hr ${minutes} min`;
  if (minutes) return `${minutes} min ${seconds} sec`;
  return `${seconds} sec`;
}
