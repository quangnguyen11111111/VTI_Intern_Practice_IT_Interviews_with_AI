import { useState, useEffect, useCallback } from 'react';
import { interviewApi } from '../../../services/api/interviewApi';
import type { InterviewSession, AnswerState } from '../types';

export const useInterviewSession = (sessionId: string) => {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSession = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let data = await interviewApi.fetchInterviewSession(sessionId);
        
        // If session is still PENDING, we need to generate questions
        if (data.status === 'PENDING') {
          setIsGenerating(true);
          try {
            await interviewApi.generateQuestions(sessionId);
            // Fetch the session again to get the generated questions
            data = await interviewApi.fetchInterviewSession(sessionId);
          } catch (genErr) {
            console.error('Failed to generate questions:', genErr);
            throw new Error('Không thể khởi tạo câu hỏi phỏng vấn bằng AI.');
          } finally {
            setIsGenerating(false);
          }
        }

        setSession(data);
        
        // Load answers from sessionStorage for F5 protection
        const savedAnswersStr = sessionStorage.getItem(`interview_${sessionId}_answers`);
        if (savedAnswersStr) {
          try {
            setAnswers(JSON.parse(savedAnswersStr));
          } catch (e) {
            console.error('Failed to parse saved answers', e);
          }
        }
      } catch (err: any) {
        console.error('Failed to load session:', err);
        setError(err.message || 'Không thể tải phiên phỏng vấn. Vui lòng kiểm tra kết nối.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  const currentQuestion = session?.questions?.[currentQuestionIndex];
  
  const handleAnswerChange = useCallback((text: string) => {
    if (!currentQuestion) return;
    
    setAnswers(prev => {
      const existing = prev.findIndex(a => a.questionId === currentQuestion._id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], candidateAnswer: text };
        return updated;
      } else {
        return [...prev, { questionId: currentQuestion._id, candidateAnswer: text }];
      }
    });
  }, [currentQuestion]);

  const currentAnswer = answers.find(a => a.questionId === currentQuestion?._id)?.candidateAnswer || '';

  const totalQuestions = session?.questions?.length || 0;
  const answeredCount = answers.filter(a => a.candidateAnswer.trim().length > 0).length;

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
    answeredCount
  };
};
