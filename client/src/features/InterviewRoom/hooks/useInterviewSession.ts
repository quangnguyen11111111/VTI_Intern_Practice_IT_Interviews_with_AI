import { useState, useEffect, useCallback } from 'react';
import { interviewApi } from '../../../services/api/interviewApi';
import type { InterviewSession, AnswerState } from '../types';
import { useInterviewSSE } from './useInterviewSSE';

export const useInterviewSession = (sessionId: string) => {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sseStatus } = useInterviewSSE(sessionId);

  const fetchSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let data = await interviewApi.fetchInterviewSession(sessionId);
      
      // If session is still PENDING, we need to generate questions
      if (data.status === 'PENDING') {
        setIsGenerating(true);
        try {
          await interviewApi.generateQuestions(sessionId);
          // Fetch the session again to get the updated status (should be GENERATING)
          data = await interviewApi.fetchInterviewSession(sessionId);
        } catch (genErr) {
          console.error('Failed to generate questions:', genErr);
          throw new Error('Không thể khởi tạo câu hỏi phỏng vấn bằng AI.');
        }
      }

      if (data.status === 'GENERATING' || data.status === 'EVALUATING') {
        setIsGenerating(true);
      } else {
        setIsGenerating(false);
      }

      if (data.status === 'COMPLETED') {
        alert('Phiên phỏng vấn đã hoàn thành!');
        window.location.href = '/';
        return;
      }
      if (data.status === 'FAILED') {
         throw new Error('Lỗi trong quá trình xử lý bằng AI.');
      }

      setSession(data);
      
      // Initialize answers from DB
      const initialAnswers: AnswerState[] = [];
      if (data.questions) {
        data.questions.forEach((q: any) => {
          const qId = q.id || q._id;
          if (qId && q.candidateAnswer) {
            initialAnswers.push({ questionId: qId, candidateAnswer: q.candidateAnswer });
          }
        });
      }

      // Load answers from sessionStorage for F5 protection and merge
      const savedAnswersStr = sessionStorage.getItem(`interview_${sessionId}_answers`);
      if (savedAnswersStr) {
        try {
          const parsed = JSON.parse(savedAnswersStr) as AnswerState[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Merge logic: session storage overwrites DB if it exists and has content
            parsed.forEach(saved => {
              if (saved.questionId && saved.candidateAnswer) {
                const existingIdx = initialAnswers.findIndex(a => a.questionId === saved.questionId);
                if (existingIdx >= 0) {
                  initialAnswers[existingIdx].candidateAnswer = saved.candidateAnswer;
                } else {
                  initialAnswers.push(saved);
                }
              }
            });
          }
        } catch (e) {
          console.error('Failed to parse saved answers', e);
        }
      }
      
      setAnswers(initialAnswers);
    } catch (err: any) {
      console.error('Failed to load session:', err);
      setError(err.message || 'Không thể tải phiên phỏng vấn. Vui lòng kiểm tra kết nối.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Handle SSE state changes
  useEffect(() => {
    if (sseStatus && session && sseStatus !== session.status) {
      console.log(`[SSE] Status changed from ${session.status} to ${sseStatus}. Refetching...`);
      if (sseStatus === 'IN_PROGRESS' || sseStatus === 'COMPLETED' || sseStatus === 'FAILED') {
        fetchSession();
      }
    }
  }, [sseStatus, session, fetchSession]);

  const currentQuestion = session?.questions?.[currentQuestionIndex];
  
  const handleAnswerChange = useCallback((text: string) => {
    if (!currentQuestion) return;
    
    const qId = currentQuestion.id || currentQuestion._id;
    if (!qId) return;

    setAnswers(prev => {
      const existing = prev.findIndex(a => a.questionId === qId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], candidateAnswer: text };
        return updated;
      } else {
        return [...prev, { questionId: qId, candidateAnswer: text }];
      }
    });
  }, [currentQuestion]);

  const currentAnswer = answers.find(a => a.questionId === (currentQuestion?.id || currentQuestion?._id))?.candidateAnswer || '';

  const totalQuestions = session?.questions?.length || 0;
  const answeredCount = answers.filter(a => a.candidateAnswer.trim().length > 0).length;

  const refetch = useCallback(() => {
    // A trick to trigger the useEffect by not changing sessionId but calling the internal fetch again
    // But since the useEffect has fetchSession inside, we can just reload the page for simplicity, 
    // or we can extract fetchSession outside.
    window.location.reload();
  }, []);

  return {
    session,
    isLoading,
    isGenerating,
    error,
    currentQuestion,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    currentAnswer,
    handleAnswerChange,
    totalQuestions,
    answeredCount,
    refetch
  };
};
