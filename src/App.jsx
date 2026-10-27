import { useEffect, useMemo, useState } from 'react';
import a1Data from '../A1.json';
import a2Data from '../A2.json';
import b1Data from '../B1.json';
import b1PlusData from '../B1+.json';
import b2Data from '../B2.json';
import AssessmentSession from './components/AssessmentSession';
import { getAssessmentStats, loadAssessmentStore } from './data/assessmentService';
import { buildLevelCatalog, buildMatchPairs, buildQuizQuestion, getLevelWordList, getTranslation, searchWords, shuffleWords } from './data/dictionaryService';

const levelDataMap = {
  A1: a1Data,
  A2: a2Data,
  B1: b1Data,
  'B1+': b1PlusData,
  B2: b2Data,
};
const progressKey = 'A-Word-progress-v1';

function safeLoadProgress() {
  if (typeof window === 'undefined') return { translationLanguage: 'Russian', totalCorrect: 0, totalWrong: 0, history: {}, cards: {} };

  try {
    const raw = localStorage.getItem(progressKey);
    if (!raw) return { translationLanguage: 'Russian', totalCorrect: 0, totalWrong: 0, history: {}, cards: {} };
    const parsed = JSON.parse(raw);
    return {
      translationLanguage: parsed.translationLanguage ?? 'Russian',
      totalCorrect: Number(parsed.totalCorrect) || 0,
      totalWrong: Number(parsed.totalWrong) || 0,
      history: parsed.history ?? {},
      cards: parsed.cards ?? {},
    };
  } catch {
    return { translationLanguage: 'Russian', totalCorrect: 0, totalWrong: 0, history: {}, cards: {} };
  }
}

function StatCard({ label, value }) {
  return (
    <div className="meta-item">
      <span className="meta-label">{label}</span>
      <span className="meta-value">{value}</span>
    </div>
  );
}

function CustomSelect({ value, onChange, options, className = '', id = '' }) {
  return (
    <div className={`custom-select ${className}`.trim()}>
      <select id={id} value={value} onChange={onChange}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function App() {
  const [assessmentStore, setAssessmentStore] = useState(() => loadAssessmentStore());
  const [view, setView] = useState(() => assessmentStore.active ? 'assessment' : 'landing');
  const [selectedLevel, setSelectedLevel] = useState('A1');
  const [selectedModule, setSelectedModule] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [translationLanguage, setTranslationLanguage] = useState('Russian');
  const [assessmentConfig, setAssessmentConfig] = useState(null);
  const [resumeAssessment, setResumeAssessment] = useState(() => Boolean(assessmentStore.active));
  const [progress, setProgress] = useState(() => safeLoadProgress());
  const [flashcardState, setFlashcardState] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [matchState, setMatchState] = useState(null);
  const [battleState, setBattleState] = useState(null);

  const levels = useMemo(() => buildLevelCatalog(levelDataMap), []);
  const currentLevel = levels.find((level) => level.id === selectedLevel) ?? levels[0];
  const allWords = useMemo(() => getLevelWordList(currentLevel), [currentLevel]);

  useEffect(() => {
    setSelectedModule('all');
    setSearchTerm('');
  }, [selectedLevel]);

  useEffect(() => {
    setProgress((previous) => ({ ...previous, translationLanguage }));
  }, [translationLanguage]);

  useEffect(() => {
    try {
      localStorage.setItem(progressKey, JSON.stringify(progress));
    } catch {
      // Ignore storage errors.
    }
  }, [progress]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const activeTag = document.activeElement?.tagName;
      const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

      if (isTyping) return;

      if (view !== 'flashcards' || !flashcardState) return;

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (!flashcardState.revealed) {
          setFlashcardState((previous) => previous ? { ...previous, revealed: true } : previous);
        }
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setFlashcardState((previous) => {
          if (!previous || previous.finished) return previous;
          const nextIndex = Math.max(previous.index - 1, 0);
          return { ...previous, index: nextIndex, revealed: false };
        });
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setFlashcardState((previous) => {
          if (!previous || previous.finished) return previous;
          const nextIndex = Math.min(previous.index + 1, previous.words.length - 1);
          return { ...previous, index: nextIndex, revealed: false };
        });
      }

      if (event.key === '1') {
        event.preventDefault();
        handleFlashcardResult(false);
      }

      if (event.key === '2') {
        event.preventDefault();
        handleFlashcardResult(true);
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        const shouldExit = window.confirm('Exit this practice session?');
        if (shouldExit) {
          setView('dictionary');
          setFlashcardState(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, flashcardState]);

  const levelWords = useMemo(() => {
    let nextWords = allWords;

    if (selectedModule !== 'all') {
      nextWords = nextWords.filter((word) => word.moduleId === selectedModule);
    }

    return searchWords(nextWords, searchTerm);
  }, [allWords, selectedModule, searchTerm]);

  const setLanguage = (language) => setTranslationLanguage(language);

  const startDictionaryView = (levelId) => {
    setSelectedLevel(levelId);
    setView('dictionary');
  };

  const startAssessment = (words = levelWords) => {
    const selectedModuleDetails = currentLevel.modules.find((module) => module.id === selectedModule);
    setAssessmentConfig({
      levelId: currentLevel.id,
      moduleTitle: selectedModuleDetails?.title ?? 'Все модули',
      language: translationLanguage,
      words,
    });
    setResumeAssessment(false);
    setView('assessment');
  };

  const resumeSavedAssessment = () => {
    setResumeAssessment(true);
    setView('assessment');
  };

  const leaveAssessment = () => {
    setAssessmentStore(loadAssessmentStore());
    setResumeAssessment(false);
    setView('dictionary');
  };

  const refreshAssessmentHistory = () => setAssessmentStore(loadAssessmentStore());

  const goBack = () => {
    setView('landing');
    setFlashcardState(null);
    setQuizState(null);
    setMatchState(null);
    setBattleState(null);
  };

  const startFlashcards = () => {
    const words = levelWords.length ? levelWords : allWords;
    if (!words.length) return;

    const sessionWords = shuffleWords(words).map((word, index) => ({ ...word, result: null, position: index + 1 }));
    setFlashcardState({
      words: sessionWords,
      index: 0,
      revealed: false,
      stats: { correct: 0, wrong: 0 },
      finished: false,
      levelId: selectedLevel,
      moduleId: selectedModule,
    });
    setView('flashcards');
  };

  const revealFlashcard = () => {
    setFlashcardState((previous) => previous ? { ...previous, revealed: true } : previous);
  };

  const handleFlashcardResult = (isCorrect) => {
    setFlashcardState((previous) => {
      if (!previous || previous.finished) return previous;

      const currentWord = previous.words[previous.index];
      const updatedWords = previous.words.map((word, index) => {
        if (index !== previous.index) return word;
        return { ...word, result: isCorrect ? 'correct' : 'wrong' };
      });

      const nextIndex = previous.index + 1;
      const isFinished = nextIndex >= updatedWords.length;

      setProgress((progressState) => {
        const safeWordId = currentWord?.id ?? `${selectedLevel}-${previous.index}`;
        return {
          ...progressState,
          totalCorrect: progressState.totalCorrect + (isCorrect ? 1 : 0),
          totalWrong: progressState.totalWrong + (isCorrect ? 0 : 1),
          history: {
            ...progressState.history,
            [safeWordId]: {
              ...(progressState.history[safeWordId] ?? {}),
              lastResult: isCorrect ? 'correct' : 'wrong',
              count: (progressState.history[safeWordId]?.count ?? 0) + 1,
            },
          },
        };
      });

      return {
        ...previous,
        words: updatedWords,
        index: nextIndex,
        revealed: false,
        stats: {
          correct: previous.stats.correct + (isCorrect ? 1 : 0),
          wrong: previous.stats.wrong + (isCorrect ? 0 : 1),
        },
        finished: isFinished,
      };
    });
  };

  const startQuiz = (levelId = selectedLevel, moduleId = selectedModule) => {
    const levelForQuiz = levels.find((entry) => entry.id === levelId) ?? currentLevel;
    const pool = moduleId === 'all'
      ? getLevelWordList(levelForQuiz)
      : (levelForQuiz.modules ?? []).find((module) => module.id === moduleId)?.words ?? [];

    if (!pool.length) return;

    const questions = [];
    for (let i = 0; i < Math.min(8, pool.length); i += 1) {
      const generated = buildQuizQuestion(pool, levelId);
      if (generated) questions.push(generated);
    }

    setQuizState({
      questions,
      index: 0,
      score: 0,
      answered: 0,
      streak: 0,
      finished: false,
      selectedAnswer: null,
      reveal: false,
    });
    setView('quiz');
  };

  const handleQuizAnswer = (answer) => {
    setQuizState((previous) => {
      if (!previous || previous.finished) return previous;

      const currentQuestion = previous.questions[previous.index];
      const correct = answer === currentQuestion.correctAnswer;

      const updatedScore = previous.score + (correct ? 1 : 0);
      const updatedStreak = correct ? previous.streak + 1 : 0;

      setProgress((progressState) => ({
        ...progressState,
        totalCorrect: progressState.totalCorrect + (correct ? 1 : 0),
        totalWrong: progressState.totalWrong + (correct ? 0 : 1),
      }));

      return {
        ...previous,
        score: updatedScore,
        streak: updatedStreak,
        answered: previous.answered + 1,
        reveal: true,
        selectedAnswer: answer,
      };
    });
  };

  const nextQuizQuestion = () => {
    setQuizState((previous) => {
      if (!previous) return previous;
      const nextIndex = previous.index + 1;
      return {
        ...previous,
        reveal: false,
        selectedAnswer: null,
        finished: nextIndex >= previous.questions.length,
        index: Math.min(nextIndex, previous.questions.length - 1),
      };
    });
  };

  const startMatchGame = () => {
    const pool = levelWords.length ? levelWords : allWords;
    if (!pool.length) return;

    const pairs = buildMatchPairs(pool, Math.min(6, pool.length));
    const englishCards = shuffleWords(pairs.map((pair) => ({ ...pair, kind: 'english', value: pair.english })));
    const translationCards = shuffleWords(pairs.map((pair) => ({ ...pair, kind: 'translation', value: pair.russian })));

    setMatchState({
      pairs,
      englishCards,
      translationCards,
      selectedEnglish: null,
      selectedTranslation: null,
      matched: [],
      mistakes: 0,
      correct: 0,
      time: 0,
      startedAt: Date.now(),
    });
    setView('match');
  };

  useEffect(() => {
    if (!matchState) return;
    const timer = window.setInterval(() => {
      setMatchState((previous) => previous ? { ...previous, time: Math.floor((Date.now() - previous.startedAt) / 1000) } : previous);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [matchState?.startedAt]);

  const handleMatchSelection = (kind, card) => {
    setMatchState((previous) => {
      if (!previous) return previous;

      if (kind === 'english') {
        if (!previous.selectedTranslation) {
          return { ...previous, selectedEnglish: card.id };
        }

        const translationMatch = previous.pairs.find((pair) => pair.id === previous.selectedTranslation);
        const englishMatch = previous.pairs.find((pair) => pair.id === card.id);
        if (translationMatch && englishMatch && translationMatch.id === englishMatch.id) {
          const nextMatched = [...previous.matched, englishMatch.id];
          return {
            ...previous,
            selectedEnglish: null,
            selectedTranslation: null,
            matched: nextMatched,
            correct: previous.correct + 1,
          };
        }

        return {
          ...previous,
          selectedEnglish: card.id,
          selectedTranslation: null,
          mistakes: previous.mistakes + 1,
        };
      }

      if (kind === 'translation') {
        if (!previous.selectedEnglish) {
          return { ...previous, selectedTranslation: card.id };
        }

        const englishMatch = previous.pairs.find((pair) => pair.id === previous.selectedEnglish);
        const translationMatch = previous.pairs.find((pair) => pair.id === card.id);
        if (englishMatch && translationMatch && englishMatch.id === translationMatch.id) {
          const nextMatched = [...previous.matched, englishMatch.id];
          return {
            ...previous,
            selectedEnglish: null,
            selectedTranslation: null,
            matched: nextMatched,
            correct: previous.correct + 1,
          };
        }

        return {
          ...previous,
          selectedTranslation: card.id,
          selectedEnglish: null,
          mistakes: previous.mistakes + 1,
        };
      }

      return previous;
    });
  };

  const startBattle = () => {
    const pool = levelWords.length ? levelWords : allWords;
    if (!pool.length) return;

    const questions = [];
    for (let i = 0; i < Math.min(5, pool.length); i += 1) {
      const generated = buildQuizQuestion(pool, selectedLevel);
      if (generated) questions.push(generated);
    }

    setBattleState({
      questions,
      index: 0,
      teamTurn: 'Team Red',
      scores: { 'Team Red': 0, 'Team Blue': 0 },
      teamA: 'Team Red',
      teamB: 'Team Blue',
      revealAnswer: false,
      showWinner: false,
    });
    setView('battle');
  };

  const revealBattleAnswer = () => {
    setBattleState((previous) => previous ? { ...previous, revealAnswer: true } : previous);
  };

  const awardBattlePoint = (team) => {
    setBattleState((previous) => {
      if (!previous) return previous;
      const scores = { ...previous.scores, [team]: previous.scores[team] + 1 };
      const nextIndex = previous.index + 1;
      const finished = nextIndex >= previous.questions.length;

      return {
        ...previous,
        scores,
        index: nextIndex,
        revealAnswer: false,
        teamTurn: team === previous.teamA ? previous.teamB : previous.teamA,
        showWinner: finished,
      };
    });
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      window.alert('Fullscreen is not available in this browser.');
    }
  };

  const currentFlashcard = flashcardState?.words?.[flashcardState.index];
  const currentQuizQuestion = quizState ? quizState.questions[quizState.index] : null;
  const wrongWords = flashcardState ? flashcardState.words.filter((word) => word.result === 'wrong') : [];

  return (
    <div className="app-shell">
      <header className={`topbar ${view === 'assessment' ? 'topbar-assessment' : ''}`}>
        <div className="container topbar-inner">
          <div className="brand">
            <span className="brand-mark">AQ</span>
            <span>A-Word</span>
          </div>

          <nav className="nav">
            <button className={view === 'landing' ? 'active' : ''} onClick={() => setView('landing')}>Home</button>
            <button className={view === 'dictionary' ? 'active' : ''} onClick={() => setView('dictionary')}>Dictionaries</button>
            <button className={view === 'flashcards' ? 'active' : ''} onClick={startFlashcards}>Practice</button>
            <button className={view === 'match' ? 'active' : ''} onClick={startMatchGame}>Games</button>
            <button className={view === 'battle' ? 'active' : ''} onClick={startBattle}>Progress</button>
          </nav>

          <div className="header-actions">
            <button className="ghost-button" onClick={toggleFullscreen}>Fullscreen</button>
            <button className="primary-button" onClick={() => setView('dictionary')}>Start learning</button>
          </div>
        </div>
      </header>

      {view === 'landing' && (
        <main>
          <section className="hero">
            <div className="container hero-grid">
              <div className="hero-copy">
                <h1>Learn words. Beat your limits.</h1>
                <p>Build your English vocabulary through interactive challenges, smart repetition, and classroom games.</p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => setView('dictionary')}>Start learning</button>
                  <button className="secondary-button" onClick={() => setView('dictionary')}>Open dictionary for class</button>
                </div>
                <div className="hero-badges">
                  <span className="badge">⚡ Smart repetition</span>
                  <span className="badge">🏆 Quiz skills</span>
                  <span className="badge">🎯 Classroom ready</span>
                </div>
              </div>

              <div className="hero-visual">
                <div className="hero-credit">
                  <span className="hero-credit-label">created by</span>
                  <span className="hero-credit-handle">@azim0nt</span>
                </div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <div className="section-header">
                <h2>Vocabulary levels</h2>
              </div>

              <div className="level-grid">
                {levels.map((level) => (
                  <div key={level.id} className={`level-card ${level.available ? '' : 'empty'}`}>
                    <div className="level-name">
                      <span>{level.name}</span>
                      <small>{level.description}</small>
                    </div>

                    <p>
                      {level.available
                        ? level.modules.length
                          ? `${level.totalWords} words across ${level.moduleCount} modules`
                          : 'No words loaded yet.'
                        : 'No dictionary loaded'}
                    </p>

                    <div className="level-meta">
                      <StatCard label="Words" value={level.totalWords || 0} />
                      <StatCard label="Modules" value={level.moduleCount || 0} />
                    </div>

                    <div className="progress-bar" style={{ '--progress': `${Math.min(100, level.totalWords ? (level.totalWords / 360) * 100 : 0)}%` }}>
                      <span />
                    </div>

                    <div className="level-card-actions">
                      <button className="small-button" onClick={() => startDictionaryView(level.id)}>Study words</button>
                      <button className="small-button secondary-button" onClick={() => { setSelectedLevel(level.id); startQuiz(level.id, 'all'); }}>Test yourself</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <div className="section-header">
                <h2>How it works</h2>
              </div>

              <div className="card-grid">
                <div className="panel">
                  <h3>1. Choose a vocabulary level</h3>
                  <p>Pick the band that matches your class and start with manageable chunks.</p>
                </div>
                <div className="panel">
                  <h3>2. Practice words and test yourself</h3>
                  <p>Use flashcards, multiple-choice questions, and quick matching exercises.</p>
                </div>
                <div className="panel">
                  <h3>3. Review mistakes and track progress</h3>
                  <p>Watch your scores improve and revisit the words that need repetition.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <div className="section-header">
                <h2>Games preview</h2>
              </div>

              <div className="card-grid">
                <button className="panel game-button" onClick={startQuiz}><h3>Multiple-choice quiz</h3><p>Train recall with fast answer choices.</p></button>
                <button className="panel game-button" onClick={startMatchGame}><h3>Word match</h3><p>Pair English words with the correct translations.</p></button>
                <button className="panel game-button" onClick={startBattle}><h3>Class battle</h3><p>Run a local classroom challenge on a single screen.</p></button>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <div className="section-header">
                <h2>Progress preview</h2>
              </div>

              {progress.totalCorrect || progress.totalWrong ? (
                <div className="panel">
                  <div className="score-row">
                    <span className="score-pill">Correct: {progress.totalCorrect}</span>
                    <span className="score-pill">Wrong: {progress.totalWrong}</span>
                    <span className="score-pill">Accuracy: {progress.totalCorrect + progress.totalWrong ? Math.round((progress.totalCorrect / (progress.totalCorrect + progress.totalWrong)) * 100) : 0}%</span>
                  </div>
                </div>
              ) : (
                <div className="empty-state">No progress yet. Start a practice session to build your vocabulary streak.</div>
              )}
              {assessmentStore.active && (
                <div className="panel assessment-home-card">
                  <div>
                    <span className="eyebrow">Unfinished assessment</span>
                    <strong>{assessmentStore.active.levelId} · {assessmentStore.active.moduleTitle}</strong>
                    <span>{assessmentStore.active.index + 1} / {assessmentStore.active.words.length} words</span>
                  </div>
                  <button className="primary-button" onClick={resumeSavedAssessment}>Continue assessment</button>
                </div>
              )}
              {assessmentStore.sessions[0] && (
                <div className="panel assessment-home-card">
                  <div>
                    <span className="eyebrow">LAST ASSESSMENT · {new Date(assessmentStore.sessions[0].finishedAt).toLocaleString('en-GB')}</span>
                    <strong>{assessmentStore.sessions[0].levelId} · {assessmentStore.sessions[0].moduleTitle}</strong>
                    <span>
                      {getAssessmentStats(assessmentStore.sessions[0]).correct} correct · {getAssessmentStats(assessmentStore.sessions[0]).incorrect} wrong · {getAssessmentStats(assessmentStore.sessions[0]).skipped} skipped
                    </span>
                  </div>
                  {assessmentStore.sessions[0].words.some((word) => word.status === 'incorrect' || word.status === 'skipped') && (
                    <button className="secondary-button" onClick={() => {
                      const previous = assessmentStore.sessions[0];
                      const words = previous.words.filter((word) => word.status === 'incorrect' || word.status === 'skipped');
                      setAssessmentConfig({
                        levelId: previous.levelId,
                        moduleTitle: previous.moduleTitle,
                        language: previous.language,
                        words,
                      });
                      setResumeAssessment(false);
                      setView('assessment');
                    }}>Retry difficult words</button>
                  )}
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {view === 'dictionary' && (
        <main className="section">
          <div className="container">
            <div className="toolbar">
              <button className="ghost-button" onClick={goBack}>← Back</button>

              <div className="toolbar-field">
                <label htmlFor="level-select">Level</label>
                <CustomSelect
                  id="level-select"
                  value={selectedLevel}
                  onChange={(event) => setSelectedLevel(event.target.value)}
                  options={levels.map((level) => ({ value: level.id, label: level.name }))}
                />
              </div>

              <div className="toolbar-field">
                <label htmlFor="module-select">Module</label>
                <CustomSelect
                  id="module-select"
                  value={selectedModule}
                  onChange={(event) => setSelectedModule(event.target.value)}
                  options={[
                    { value: 'all', label: 'All modules' },
                    ...((currentLevel.modules ?? []).map((module) => ({ value: module.id, label: `${module.title} · ${module.words.length} words` }))),
                  ]}
                />
              </div>

              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search words or translations" />

              <div className="toolbar-field toolbar-field-small">
                <label htmlFor="language-select">Language</label>
                <CustomSelect
                  id="language-select"
                  value={translationLanguage}
                  onChange={(event) => setLanguage(event.target.value)}
                  options={[
                    { value: 'Russian', label: 'Russian' },
                    { value: 'Uzbek', label: 'Uzbek' },
                  ]}
                />
              </div>

              <button className="primary-button dictionary-practice-button" onClick={() => startAssessment()} disabled={!levelWords.length}>Practice this set · {levelWords.length}</button>
            </div>

            <div className="panel">
              <h2>{currentLevel.name} dictionary</h2>
              <p>{currentLevel.available ? `${currentLevel.totalWords} words in ${currentLevel.moduleCount} modules` : 'This level is not loaded yet.'}</p>
              <p className="dictionary-selection-summary">
                Selected set: {levelWords.length} words · Translation: {translationLanguage === 'Uzbek' ? 'Uzbek' : 'Russian'}
              </p>

              {!currentLevel.available ? (
                <div className="empty-state">No dictionary has been loaded for this level yet. Add a JSON file to unlock it here.</div>
              ) : levelWords.length === 0 ? (
                <div className="empty-state">No words match this filter. Try a different module or search term.</div>
              ) : (
                <div className="word-table">
                  {levelWords.map((word) => (
                    <div key={word.id} className="word-card">
                      <strong>{word.word}</strong>
                      <div className="translations">
                        <span><strong>Russian:</strong> {word.russian}</span>
                        <span><strong>Uzbek:</strong> {word.uzbek}</span>
                      </div>
                      <div className="actions">
                        <button className="small-button" onClick={() => startFlashcards()}>Practice</button>
                        <button className="small-button secondary-button" onClick={() => { setSelectedLevel(currentLevel.id); setView('dictionary'); }}>Open</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {view === 'flashcards' && (
        <main className="section flashcard-shell">
          <div className="container">
            <div className="flashcard">
              <div className="flashcard-top">
                <button className="ghost-button" onClick={goBack}>Exit</button>
                <span>{currentFlashcard ? `${flashcardState.index + 1} / ${flashcardState.words.length}` : '0 / 0'}</span>
              </div>

              {flashcardState?.finished ? (
                <div className="result-card">
                  <div className="result-header">
                    <div>
                      <span className="eyebrow">Practice summary</span>
                      <h2>Session complete</h2>
                    </div>
                    <span className="result-badge">{flashcardState.words.length ? Math.round((flashcardState.stats.correct / flashcardState.words.length) * 100) : 0}% accuracy</span>
                  </div>

                  <div className="result-summary">
                    <div className="result-stat success">
                      <span className="result-label">Reviewed</span>
                      <strong>{flashcardState.words.length}</strong>
                    </div>
                    <div className="result-stat success">
                      <span className="result-label">Correct</span>
                      <strong>{flashcardState.stats.correct}</strong>
                    </div>
                    <div className="result-stat danger">
                      <span className="result-label">Wrong</span>
                      <strong>{flashcardState.stats.wrong}</strong>
                    </div>
                    <div className="result-stat neutral">
                      <span className="result-label">Accuracy</span>
                      <strong>{flashcardState.words.length ? Math.round((flashcardState.stats.correct / flashcardState.words.length) * 100) : 0}%</strong>
                    </div>
                  </div>

                  <div className="review-panel">
                    <div className="review-header">
                      <span>Words to revisit</span>
                      <strong>{wrongWords.length}</strong>
                    </div>

                    {wrongWords.length > 0 ? (
                      <div className="wrong-word-list">
                        {wrongWords.map((word) => (
                          <span key={word.id} className="wrong-word-pill">{word.word}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="review-empty">Perfect round — no words were marked wrong.</p>
                    )}
                  </div>

                  <div className="flashcard-actions result-actions">
                    <button className="primary-button" onClick={startFlashcards}>Retry mistakes</button>
                    <button className="secondary-button" onClick={() => setView('dictionary')}>Return to dictionary</button>
                  </div>
                </div>
              ) : currentFlashcard ? (
                <>
                  <div className="flashcard-word">{currentFlashcard.word}</div>
                  {flashcardState.revealed ? (
                    <div className="empty-state">
                      <strong>{getTranslation(currentFlashcard, translationLanguage)}</strong>
                    </div>
                  ) : (
                    <div className="empty-state">Reveal the translation when you are ready.</div>
                  )}

                  <div className="flashcard-actions">
                    {!flashcardState.revealed ? (
                      <button className="primary-button" onClick={revealFlashcard}>Reveal translation</button>
                    ) : (
                      <>
                        <button className="wrong-button primary-button" onClick={() => handleFlashcardResult(false)}>Wrong</button>
                        <button className="correct-button primary-button" onClick={() => handleFlashcardResult(true)}>Correct</button>
                      </>
                    )}
                  </div>

                  <div className="keyboard-help">
                    <span className="keycap">Space</span>
                    <span className="keycap">←</span>
                    <span className="keycap">→</span>
                    <span className="keycap">1</span>
                    <span className="keycap">2</span>
                    <span className="keycap">Esc</span>
                  </div>
                </>
              ) : (
                <div className="empty-state">No words are available in this selection.</div>
              )}
            </div>
          </div>
        </main>
      )}

      {view === 'assessment' && (
        <AssessmentSession
          config={assessmentConfig ?? {
            levelId: selectedLevel,
            moduleTitle: 'Выбранный набор',
            language: translationLanguage,
            words: [],
          }}
          resume={resumeAssessment}
          onExit={leaveAssessment}
          onComplete={refreshAssessmentHistory}
        />
      )}

      {view === 'quiz' && (
        <main className="section">
          <div className="container">
            <div className="panel">
              <div className="section-header">
                <h2>Multiple-choice quiz</h2>
                <button className="ghost-button" onClick={goBack}>Exit</button>
              </div>

              {quizState?.finished ? (
                <>
                  <div className="score-row">
                    <span className="score-pill">Score: {quizState.score} / {quizState.questions.length}</span>
                    <span className="score-pill">Streak: {quizState.streak}</span>
                    <span className="score-pill">Accuracy: {quizState.questions.length ? Math.round((quizState.score / quizState.questions.length) * 100) : 0}%</span>
                  </div>
                  <div className="empty-state">Final result for this quiz round.</div>
                  <div className="flashcard-actions">
                    <button className="primary-button" onClick={startQuiz}>Retry quiz</button>
                    <button className="secondary-button" onClick={() => setView('dictionary')}>Return to dictionary</button>
                  </div>
                </>
              ) : currentQuizQuestion ? (
                <>
                  <div className="score-row">
                    <span className="score-pill">Question: {quizState.index + 1} / {quizState.questions.length}</span>
                    <span className="score-pill">Score: {quizState.score}</span>
                    <span className="score-pill">Streak: {quizState.streak}</span>
                  </div>

                  <div className="flashcard-word">{currentQuizQuestion.prompt.word}</div>

                  <div className="quiz-grid">
                    {currentQuizQuestion.options.map((option) => {
                      const isCorrect = option === currentQuizQuestion.correctAnswer;
                      const isSelected = quizState.selectedAnswer === option;
                      const className = quizState.reveal
                        ? isCorrect
                          ? 'option-button correct'
                          : isSelected
                            ? 'option-button wrong'
                            : 'option-button'
                        : 'option-button';

                      return (
                        <button key={option} className={className} onClick={() => !quizState.reveal && handleQuizAnswer(option)} disabled={quizState.reveal}>
                          {option}
                        </button>
                      );
                    })}
                  </div>

                  {quizState.reveal && (
                    <div className="empty-state">
                      {quizState.selectedAnswer === currentQuizQuestion.correctAnswer ? 'Correct answer!' : `The correct answer was: ${currentQuizQuestion.correctAnswer}`}
                    </div>
                  )}

                  <div className="flashcard-actions">
                    {quizState.reveal ? (
                      <button className="primary-button" onClick={nextQuizQuestion}>Next question</button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="empty-state">No quiz material is available for this level.</div>
              )}
            </div>
          </div>
        </main>
      )}

      {view === 'match' && (
        <main className="section">
          <div className="container">
            <div className="panel">
              <div className="section-header">
                <h2>Word match</h2>
                <button className="ghost-button" onClick={goBack}>Exit</button>
              </div>

              {matchState ? (
                <>
                  <div className="score-row">
                    <span className="score-pill">Correct: {matchState.correct}</span>
                    <span className="score-pill">Mistakes: {matchState.mistakes}</span>
                    <span className="score-pill">Time: {matchState.time}s</span>
                  </div>

                  {matchState.correct + matchState.mistakes >= matchState.pairs.length ? (
                    <div className="empty-state">Game complete! You matched {matchState.correct} pairs.</div>
                  ) : (
                    <div className="match-board">
                      <div className="match-list">
                        {matchState.englishCards.map((card) => {
                          const selected = matchState.selectedEnglish === card.id;
                          const completed = matchState.matched.includes(card.id);
                          return (
                            <button
                              key={card.id}
                              className={`match-card ${selected ? 'selected' : ''} ${completed ? 'correct' : ''}`}
                              onClick={() => !completed && handleMatchSelection('english', card)}
                              disabled={completed}
                            >
                              {card.value}
                            </button>
                          );
                        })}
                      </div>

                      <div className="match-list">
                        {matchState.translationCards.map((card) => {
                          const selected = matchState.selectedTranslation === card.id;
                          const completed = matchState.matched.includes(card.id);
                          return (
                            <button
                              key={card.id}
                              className={`match-card ${selected ? 'selected' : ''} ${completed ? 'correct' : ''}`}
                              onClick={() => !completed && handleMatchSelection('translation', card)}
                              disabled={completed}
                            >
                              {card.value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">Choose a level and launch the matching game.</div>
              )}
            </div>
          </div>
        </main>
      )}

      {view === 'battle' && (
        <main className="section">
          <div className="container">
            <div className="panel">
              <div className="section-header">
                <h2>Class battle</h2>
                <button className="ghost-button" onClick={goBack}>Exit</button>
              </div>

              {!battleState ? (
                <div className="empty-state">Start a local team battle to begin the round.</div>
              ) : battleState.showWinner ? (
                <>
                  <div className="empty-state">Winner: {battleState.scores['Team Red'] > battleState.scores['Team Blue'] ? 'Team Red' : 'Team Blue'} with {Math.max(battleState.scores['Team Red'], battleState.scores['Team Blue'])} points.</div>
                  <div className="flashcard-actions">
                    <button className="primary-button" onClick={startBattle}>Restart</button>
                    <button className="secondary-button" onClick={goBack}>Return</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="battle-board">
                    <div className={`team-score ${battleState.teamTurn === 'Team Red' ? 'active' : ''}`}>
                      <h3>Team Red</h3>
                      <div className="battle-question">{battleState.scores['Team Red']}</div>
                    </div>
                    <div className={`team-score ${battleState.teamTurn === 'Team Blue' ? 'active' : ''}`}>
                      <h3>Team Blue</h3>
                      <div className="battle-question">{battleState.scores['Team Blue']}</div>
                    </div>
                  </div>

                  <div className="battle-question">
                    {battleState.questions[battleState.index]?.prompt.word}
                  </div>

                  {battleState.revealAnswer && (
                    <div className="empty-state">
                      {battleState.questions[battleState.index]?.correctAnswer}
                    </div>
                  )}

                  <div className="flashcard-actions">
                    <button className="secondary-button" onClick={revealBattleAnswer}>Reveal answer</button>
                    <button className="wrong-button primary-button" onClick={() => awardBattlePoint('Team Red')}>Award Team Red</button>
                    <button className="correct-button primary-button" onClick={() => awardBattlePoint('Team Blue')}>Award Team Blue</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
