export const LEVEL_DEFINITIONS = [
  { id: 'A1', name: 'A1', description: 'Beginner' },
  { id: 'A2', name: 'A2', description: 'Elementary' },
  { id: 'B1', name: 'B1', description: 'Intermediate' },
  { id: 'B1+', name: 'B1+', description: 'Upper Intermediate Bridge' },
  { id: 'B2', name: 'B2', description: 'Upper-Intermediate' },
];

export function sanitizeText(value, fallback = 'Not available') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const cleaned = value.trim();
  return cleaned || fallback;
}

export function createWordId(levelId, moduleId, index) {
  return `${String(levelId).toUpperCase()}-${String(moduleId).trim()}-${String(index).padStart(3, '0')}`;
}

export function normalizeWordData(word, levelId, moduleId, index) {
  const wordText = sanitizeText(word?.word ?? '', 'Unnamed word');

  return {
    id: word?.id || createWordId(levelId, moduleId, index),
    word: wordText,
    uzbek: sanitizeText(word?.uzbek ?? word?.uz ?? '', 'Uzbek translation unavailable'),
    russian: sanitizeText(word?.russian ?? word?.ru ?? '', 'Russian translation unavailable'),
  };
}

export function parseDictionary(data, levelId = 'A1') {
  if (!Array.isArray(data) && (!data || typeof data !== 'object')) {
    return {
      valid: false,
      error: 'Invalid dictionary format. Expected an array or a module map.',
      modules: [],
      totalWords: 0,
    };
  }

  const rawModules = Array.isArray(data)
    ? data
    : Object.entries(data).flatMap(([moduleName, parts]) => {
      if (!parts || typeof parts !== 'object' || Array.isArray(parts)) {
        return [];
      }

      return Object.entries(parts).map(([partName, pages]) => ({
        module: `${moduleName}-${partName}`,
        title: `${moduleName} ${partName.toUpperCase()}`,
        words: Object.values(pages ?? {}).flatMap((pageWords) => (
          Array.isArray(pageWords) ? pageWords : []
        )),
      }));
    });

  const modules = rawModules
    .map((module, moduleIndex) => {
      const moduleId = sanitizeText(module?.module ?? `module-${moduleIndex + 1}`, `module-${moduleIndex + 1}`);
      const title = sanitizeText(module?.title ?? moduleId, moduleId);
      const rawWords = Array.isArray(module?.words) ? module.words : [];

      return {
        id: moduleId,
        title,
        words: rawWords.map((word, wordIndex) => normalizeWordData(word, levelId, moduleId, wordIndex)),
      };
    })
    .filter((module) => module.words.length > 0);

  return {
    valid: true,
    modules,
    totalWords: modules.reduce((sum, module) => sum + module.words.length, 0),
  };
}

export function buildLevelCatalog(dataMap) {
  return LEVEL_DEFINITIONS.map((level) => {
    const dictionaryData = dataMap[level.id] ?? null;
    const parsed = dictionaryData ? parseDictionary(dictionaryData, level.id) : { valid: true, modules: [], totalWords: 0 };

    return {
      ...level,
      available: Boolean(dictionaryData),
      totalWords: parsed.totalWords,
      moduleCount: parsed.modules.length,
      modules: parsed.modules,
      error: !parsed.valid ? parsed.error : null,
    };
  });
}

export function getLevelSummary(data, levelId = 'A1') {
  const parsed = parseDictionary(data, levelId);
  return {
    levelId,
    totalWords: parsed.totalWords,
    moduleCount: parsed.modules.length,
    valid: parsed.valid,
    modules: parsed.modules,
    error: parsed.error ?? null,
  };
}

export function getTranslation(word, language = 'Russian') {
  const languageKey = language.toLowerCase();

  if (languageKey === 'uzbek') {
    return word?.uzbek || 'Uzbek translation unavailable';
  }

  return word?.russian || 'Russian translation unavailable';
}

export function shuffleWords(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

export function searchWords(words, query) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return words;
  }

  return words.filter((word) => {
    const haystack = `${word.word} ${word.russian} ${word.uzbek}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function buildQuizQuestion(words, levelId) {
  if (!words || words.length < 2) {
    return null;
  }

  const prompt = words[Math.floor(Math.random() * words.length)];
  const distractorPool = words.filter((word) => word.id !== prompt.id);
  const distractors = shuffleWords(distractorPool).slice(0, 3).map((word) => word.russian || word.uzbek);
  const options = shuffleWords([
    prompt.russian,
    ...distractors,
  ]);

  return {
    levelId,
    prompt,
    correctAnswer: prompt.russian,
    options,
    explanation: `The correct answer is ${prompt.russian}.`,
  };
}

export function buildMatchPairs(words, pairCount = 6) {
  const selected = shuffleWords(words).slice(0, Math.min(pairCount, words.length));

  return selected.map((word) => ({
    id: word.id,
    english: word.word,
    russian: word.russian,
    uzbek: word.uzbek,
  }));
}

export function getLevelWordList(level) {
  return (level?.modules ?? []).flatMap((module) => module.words.map((word) => ({ ...word, moduleId: module.id, title: module.title })));
}
