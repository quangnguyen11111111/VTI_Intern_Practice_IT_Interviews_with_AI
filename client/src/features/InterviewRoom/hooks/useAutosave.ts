import { useEffect, useRef, useState } from 'react';
import { interviewApi } from '../../../services/api/interviewApi';
import type { AnswerState } from '../types';


export const useAutosave = (sessionId: string, answers: AnswerState[], debounceMs: number = 2000) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Keep track of the latest answers without triggering effects immediately
  const answersRef = useRef(answers);
  
  useEffect(() => {
    answersRef.current = answers;
    
    // Save to local session storage for F5 protection
    // Don't overwrite with empty array on initial mount before data is loaded
    if (sessionId && answers.length > 0) {
      sessionStorage.setItem(`interview_${sessionId}_answers`, JSON.stringify(answers));
    }
  }, [answers, sessionId]);

  useEffect(() => {
    if (!sessionId || answers.length === 0) return;

    const abortController = new AbortController();
    
    const timeoutId = setTimeout(async () => {
      setIsSaving(true);
      setSaveError(null);
      try {
        await interviewApi.saveInterviewProgress(sessionId, answersRef.current);
        if (!abortController.signal.aborted) {
          setLastSaved(new Date());
          setIsSaving(false);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('Autosave failed:', err);
          setSaveError('Saving failed, retrying...');
          setIsSaving(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [answers, sessionId, debounceMs]);

  // Manually force a save if needed (e.g. before submitting)
  const forceSave = async () => {
    if (!sessionId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await interviewApi.saveInterviewProgress(sessionId, answersRef.current);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Force save failed:', err);
      setSaveError('Failed to save progress.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return { isSaving, lastSaved, saveError, forceSave };
};
