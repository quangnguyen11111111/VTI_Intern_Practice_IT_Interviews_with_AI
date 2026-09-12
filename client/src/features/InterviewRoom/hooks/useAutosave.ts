import { useCallback, useEffect, useRef, useState } from 'react';
import { interviewApi } from '../../../services/api/interviewApi';
import type { AnswerState } from '../types';


export const useAutosave = (
  sessionId: string,
  answers: AnswerState[],
  version: number | undefined,
  onVersion: (version: number) => void,
  debounceMs: number = 2000
) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Keep track of the latest answers without triggering effects immediately
  const answersRef = useRef(answers);
  const versionRef = useRef(version ?? 0);
  const saveChainRef = useRef<Promise<number>>(Promise.resolve(version ?? 0));

  useEffect(() => {
    if (version !== undefined && version > versionRef.current) versionRef.current = version;
  }, [version]);
  
  useEffect(() => {
    answersRef.current = answers;
    
    // Save to local session storage for F5 protection
    // Don't overwrite with empty array on initial mount before data is loaded
    if (sessionId && answers.length > 0) {
      sessionStorage.setItem(
        `interview_${sessionId}_answers`,
        JSON.stringify({ version: versionRef.current, answers })
      );
    }
  }, [answers, sessionId, version]);

  const saveSnapshot = useCallback(async (): Promise<number> => {
    if (!sessionId || answersRef.current.length === 0) return versionRef.current;
    const snapshot = answersRef.current.map((answer) => ({ ...answer }));
    const pending = saveChainRef.current
      .catch(() => versionRef.current)
      .then(async () => {
        const result = await interviewApi.saveInterviewProgress(
          sessionId,
          versionRef.current,
          snapshot
        );
        versionRef.current = result.version;
        onVersion(result.version);
        return result.version as number;
      });
    saveChainRef.current = pending;
    return pending;
  }, [onVersion, sessionId]);

  useEffect(() => {
    if (!sessionId || answers.length === 0) return;

    const abortController = new AbortController();
    
    const timeoutId = setTimeout(async () => {
      setIsSaving(true);
      setSaveError(null);
      try {
        await saveSnapshot();
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
  }, [answers, sessionId, debounceMs, saveSnapshot]);

  // Manually force a save if needed (e.g. before submitting)
  const forceSave = async () => {
    if (!sessionId) return versionRef.current;
    setIsSaving(true);
    setSaveError(null);
    try {
      const savedVersion = await saveSnapshot();
      setLastSaved(new Date());
      return savedVersion;
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
