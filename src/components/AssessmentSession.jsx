import { useEffect, useMemo, useState } from 'react';
import {
  createAssessment,
  finishAssessment,
  formatAssessmentDuration,
  getAssessmentStats,
  loadAssessmentStore,
  saveAssessmentStore,
  updateAssessmentWord,
} from '../data/assessmentService';
import { copyAssessmentReport, downloadAssessmentReport } from '../data/assessmentReport';
import CopyAssessmentWordListButton from './CopyAssessmentWordListButton';
import AssessmentWordGroup from './AssessmentWordGroup';

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('en-GB');
}

export default function AssessmentSession({ config, resume = false, onExit, onComplete }) {
  const [session, setSession] = useState(() => {
    const saved = resume ? loadAssessmentStore().active : null;
    return saved ?? createAssessment(config);
  });
  const [translationVisible, setTranslationVisible] = useState(false);
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');
  const [clock, setClock] = useState(Date.now());

  const stats = useMemo(() => getAssessmentStats(session), [session]);
  const currentWord = session.words[session.index];
  const durationMs = session.startedAt
    ? (session.finishedAt ?? clock) - session.startedAt
    : 0;
  const duration = formatAssessmentDuration(durationMs);
  const progress = stats.total ? ((session.index + (session.phase === 'complete' ? 0 : 1)) / stats.total) * 100 : 0;

  useEffect(() => {
    if (session.phase !== 'active') return undefined;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session.phase]);

  useEffect(() => {
    if (session.phase !== 'active') return;
    try {
      saveAssessmentStore({ ...loadAssessmentStore(), active: session });
    } catch {
      setExportError('Could not save this session in your browser. Check storage availability and try again.');
    }
  }, [session]);

  const completeSession = (updatedSession) => {
    const finished = finishAssessment(updatedSession);

    setSession(finished);
    setTranslationVisible(false);
    try {
      const store = loadAssessmentStore();
      saveAssessmentStore({
        active: null,
        sessions: [finished, ...store.sessions.filter((item) => item.id !== finished.id)].slice(0, 30),
      });
    } catch {
      setExportError('The assessment is complete, but could not be saved to browser history.');
    }
    onComplete(finished);
  };

  const recordResult = (status) => {
    if (session.phase !== 'active') return;
    const updated = updateAssessmentWord(session, session.index, status);
    setTranslationVisible(false);

    if (session.index >= session.words.length - 1) {
      completeSession(updated);
    } else {
      setSession({ ...updated, index: session.index + 1 });
    }
  };

  const startSession = () => {
    if (!session.words.length) return;
    setSession({ ...session, phase: 'active', startedAt: Date.now(), index: 0 });
    setClock(Date.now());
  };

  const finishEarly = () => {
    if (!window.confirm('Finish this session now? Unanswered words will be marked as skipped.')) return;
    completeSession(session);
  };

  const leaveSession = () => {
    if (session.phase === 'active' && !window.confirm('Leave this session? Your progress will be saved so you can continue later.')) return;
    onExit();
  };

  useEffect(() => {
    if (session.phase !== 'active') return undefined;
    const handleKeyDown = (event) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (tag === 'BUTTON' && (event.key === ' ' || event.key === 'Enter')) return;

      if (event.key === 'ArrowLeft' && session.index > 0) {
        event.preventDefault();
        setSession((previous) => ({ ...previous, index: Math.max(0, previous.index - 1) }));
        setTranslationVisible(false);
      } else if (event.key === '1') {
        recordResult('correct');
      } else if (event.key === '2') {
        recordResult('incorrect');
      } else if (event.key === '3') {
        recordResult('skipped');
      } else if (event.key === ' ') {
        event.preventDefault();
        setTranslationVisible((visible) => !visible);
      } else if (event.key === 'Escape') {
        leaveSession();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session]);

  const startRetry = () => {
    const retryWords = session.words.filter((word) => word.status === 'incorrect' || word.status === 'skipped');
    const nextSession = createAssessment({
      levelId: session.levelId,
      moduleTitle: session.moduleTitle,
      language: session.language,
      words: retryWords,
    });
    setSession(nextSession);
    setTranslationVisible(false);
    setExportError('');
  };

  const exportReport = async (action) => {
    setExportError('');
    setExporting(action);
    try {
      if (action === 'copy') {
        await copyAssessmentReport(session, stats, duration);
      } else {
        await downloadAssessmentReport(session, stats, duration);
      }
      setExportError(action === 'copy' ? 'Image copied to clipboard.' : '');
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not create the PNG report.');
    } finally {
      setExporting('');
    }
  };

  if (session.phase === 'setup') {
    return (
      <main className="section assessment-page">
        <div className="container assessment-container">
          <section className="panel assessment-setup">
            <button className="ghost-button" onClick={leaveSession}>← Back to dictionary</button>
            <span className="eyebrow">Word assessment</span>
            <h1>{session.levelId} · {session.moduleTitle}</h1>
            <div className="assessment-setup-details">
              <div><span>Words in this set</span><strong>{session.words.length}</strong></div>
              <div><span>Translation language</span><strong>{session.language === 'Uzbek' ? 'Uzbek' : 'Russian'}</strong></div>
            </div>
            {session.words.length ? (
              <button className="primary-button assessment-primary-action" onClick={startSession}>Start session</button>
            ) : (
              <div className="empty-state">No words in this set. Choose a module or adjust your search.</div>
            )}
          </section>
        </div>
      </main>
    );
  }

  if (session.phase === 'active' && currentWord) {
    return (
      <main className="section assessment-page">
        <div className="container assessment-container">
          <section className="panel assessment-live" aria-label="Word assessment">
            {exportError && <p className="assessment-error" role="alert">{exportError}</p>}
            <div className="assessment-live-top">
              <div>
                <span className="eyebrow">{session.levelId} · {session.moduleTitle}</span>
                <strong className="assessment-position">{session.index + 1} / {stats.total}</strong>
              </div>
              <button className="ghost-button" onClick={finishEarly}>Finish session</button>
            </div>
            <div className="assessment-progress" role="progressbar" aria-label="Assessment progress" aria-valuenow={session.index + 1} aria-valuemin={1} aria-valuemax={stats.total}>
              <span style={{ width: `${progress}%` }} />
            </div>

            <div className="assessment-counters" aria-live="polite">
              <span className="assessment-count correct">Correct <strong>{stats.correct}</strong></span>
              <span className="assessment-count incorrect">Wrong <strong>{stats.incorrect}</strong></span>
              <span className="assessment-count skipped">Skipped <strong>{stats.skipped}</strong></span>
            </div>

            <div className="assessment-word" aria-live="polite">{currentWord.word}</div>
            {translationVisible ? (
              <div className="assessment-translation" aria-live="polite">
                <span>{session.language === 'Uzbek' ? 'Uzbek translation' : 'Russian translation'}</span>
                <strong>{session.language === 'Uzbek' ? currentWord.uzbek : currentWord.russian}</strong>
              </div>
            ) : (
              <button className="secondary-button assessment-reveal" onClick={() => setTranslationVisible(true)}>Show translation</button>
            )}

            <div className="assessment-controls">
              <button className="ghost-button assessment-control-back" onClick={() => {
                setSession((previous) => ({ ...previous, index: Math.max(0, previous.index - 1) }));
                setTranslationVisible(false);
              }} disabled={session.index === 0}>← Back</button>
              <button className="assessment-answer incorrect" onClick={() => recordResult('incorrect')}>Wrong</button>
              <button className="assessment-answer skipped" onClick={() => recordResult('skipped')}>Skip</button>
              <button className="assessment-answer correct" onClick={() => recordResult('correct')}>Correct</button>
            </div>
            <div className="assessment-footer">
              <span>Time: {duration}</span>
              <button className="ghost-button" onClick={leaveSession}>Exit and continue later</button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const incorrectWords = session.words.filter((word) => word.status === 'incorrect');
  const skippedWords = session.words.filter((word) => word.status === 'skipped');
  const correctWords = session.words.filter((word) => word.status === 'correct');
  const evaluated = stats.correct + stats.incorrect;

  return (
    <main className="section assessment-page">
      <div className="container assessment-container assessment-results">
        <section className="panel">
          <div className="assessment-result-top">
            <button className="ghost-button" onClick={onExit}>Exit</button>
            <span>{stats.total} / {stats.total}</span>
          </div>
          <div className="assessment-results-header">
            <div>
              <span className="eyebrow">Practice summary</span>
              <h1>Session complete</h1>
            </div>
            <div className="assessment-report-actions">
              <CopyAssessmentWordListButton words={session.words} language={session.language} />
              <button className="secondary-button" onClick={() => exportReport('copy')} disabled={Boolean(exporting)}>
                {exporting === 'copy' ? 'Preparing image…' : 'Copy image'}
              </button>
              <button className="primary-button" onClick={() => exportReport('download')} disabled={Boolean(exporting)}>
                {exporting === 'download' ? 'Preparing image…' : 'Download report'}
              </button>
            </div>
          </div>

          {exportError && <p className={`assessment-feedback ${exportError.startsWith('Image copied') ? 'success' : ''}`} role="status">{exportError}</p>}

          <div className="assessment-result-stats">
            <div className="assessment-result-card"><span>Reviewed</span><strong>{stats.total}</strong></div>
            <div className="assessment-result-card correct"><span>Correct</span><strong>{stats.correct}</strong></div>
            <div className="assessment-result-card incorrect"><span>Wrong</span><strong>{stats.incorrect}</strong></div>
            <div className="assessment-result-card"><span>Accuracy</span><strong>{evaluated ? `${stats.accuracy}%` : 'No data'}</strong></div>
          </div>

          <div className="assessment-chart" role="img" aria-label={`Correct: ${stats.correct}, wrong: ${stats.incorrect}, skipped: ${stats.skipped}`}>
            <span className="correct" style={{ width: `${stats.total ? (stats.correct / stats.total) * 100 : 0}%` }} />
            <span className="incorrect" style={{ width: `${stats.total ? (stats.incorrect / stats.total) * 100 : 0}%` }} />
            <span className="skipped" style={{ width: `${stats.total ? (stats.skipped / stats.total) * 100 : 0}%` }} />
          </div>
          <div className="assessment-chart-legend">
            <span className="correct">Correct · {stats.correct}</span><span className="incorrect">Wrong · {stats.incorrect}</span><span className="skipped">Skipped · {stats.skipped}</span>
          </div>
        </section>

        <section className="panel assessment-word-groups">
          {[
            { title: 'Correctly translated', words: correctWords, className: 'correct', copyLabel: 'Copy correct words' },
            { title: 'Words to revisit', words: incorrectWords, className: 'incorrect', copyLabel: 'Copy wrong words' },
            { title: 'Skipped', words: skippedWords, className: 'skipped', copyLabel: 'Copy skipped words' },
          ].map((group) => (
            <AssessmentWordGroup
              key={group.title}
              {...group}
              language={session.language}
            />
          ))}
        </section>

        <div className="assessment-result-actions">
          {(incorrectWords.length + skippedWords.length > 0) && (
            <button className="primary-button" onClick={startRetry}>Retry mistakes</button>
          )}
          <button className="secondary-button" onClick={() => setSession(createAssessment(config))}>Start a new session</button>
          <button className="ghost-button" onClick={onExit}>Return to dictionary</button>
        </div>
      </div>
    </main>
  );
}
