import { useState } from 'react';
import { copyAssessmentWordList } from '../data/assessmentWordList';

export default function CopyAssessmentWordListButton({ words, language, label = 'Copy word list' }) {
  const [message, setMessage] = useState('');
  const [copying, setCopying] = useState(false);

  const copyWordList = async () => {
    setCopying(true);
    setMessage('');

    try {
      await copyAssessmentWordList(words, language);
      setMessage(`${label.replace(/^Copy /, '')} copied.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not copy the word list.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <>
      <button className="secondary-button" onClick={copyWordList} disabled={copying || words.length === 0}>
        {copying ? 'Copying…' : label}
      </button>
      {message && <span className="word-list-copy-feedback" role="status">{message}</span>}
    </>
  );
}
