import { useState } from 'react';
import CopyAssessmentWordListButton from './CopyAssessmentWordListButton';

export default function AssessmentWordGroup({ title, words, className, copyLabel, language }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = words.length > 4;

  return (
    <div className={`assessment-word-group ${className}`}>
      <div className="assessment-word-group-header">
        <h2>{title} <span>{words.length}</span></h2>
        <CopyAssessmentWordListButton
          words={words}
          language={language}
          label={copyLabel}
        />
      </div>
      {words.length ? (
        <>
          <div
            className={`assessment-word-list-window ${canExpand && !expanded ? 'collapsed' : ''}`}
            id={`assessment-word-list-${className}`}
          >
            <div className="assessment-result-word-list">
              {words.map((word) => (
                <div className="assessment-result-word" key={word.id}>
                  <strong>{word.word}</strong>
                  <span>Russian: {word.russian}</span>
                  <span>Uzbek: {word.uzbek}</span>
                </div>
              ))}
            </div>
          </div>
          {canExpand && (
            <button
              className="ghost-button assessment-word-list-toggle"
              onClick={() => setExpanded((previous) => !previous)}
              aria-expanded={expanded}
              aria-controls={`assessment-word-list-${className}`}
            >
              {expanded ? 'Show fewer words' : `Show all words (${words.length})`}
            </button>
          )}
        </>
      ) : <p className="review-empty">No words in this group.</p>}
    </div>
  );
}
