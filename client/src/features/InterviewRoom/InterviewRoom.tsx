import React, { useCallback, useEffect, useRef } from 'react';
import { interviewApi } from '../../services/api/interviewApi';
import { useParams, useNavigate } from 'react-router-dom';
import { useInterviewSession } from './hooks/useInterviewSession';
import { useInterviewTimer } from './hooks/useInterviewTimer';
import { useAutosave } from './hooks/useAutosave';
import { useBeforeUnload } from './hooks/useBeforeUnload';
import { ProgressBar } from './components/ProgressBar';
import { InterviewLoadingScreen } from './components/InterviewLoadingScreen';
import { QuestionNavigator } from './components/QuestionNavigator';
import { QuestionCard } from './components/QuestionCard';

export const InterviewRoom: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const {
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
  } = useInterviewSession(sessionId || '');

  const { isSaving, saveError, forceSave } = useAutosave(sessionId || '', answers, 1500);

  // Enable F5 protection
  useBeforeUnload(true);

  const answeredIndices = (() => {
    const indices = new Set<number>();
    if (session?.questions) {
      session.questions.forEach((q, idx) => {
        const qId = q.id || q._id;
        const answer = answers.find(a => a.questionId === qId);
        if (answer && answer.candidateAnswer.trim().length > 0) {
          indices.add(idx);
        }
      });
    }
    return indices;
  })();

  const submitRef = useRef<((isAutoSubmit?: boolean) => Promise<void>) | null>(null);
  // Timer: 20 minutes (1200 seconds)
  const { formattedTime, progressRatio, stopTimer } = useInterviewTimer(1200, session?.createdAt || null, async () => {
    // Auto-submit when time is up
    if (submitRef.current) { await submitRef.current(true); }
  });

  const handleSubmit = useCallback(async (isAutoSubmit = false) => {
    if (!isAutoSubmit && session?.questions) {
      const unansweredIndex = session.questions.findIndex((_, idx) => !answeredIndices.has(idx));
      
      if (unansweredIndex !== -1) {
        setCurrentQuestionIndex(unansweredIndex);
        alert(`B?n chua tr? l?i c�u h?i s? ${unansweredIndex + 1}. Vui l�ng ho�n thi?n n?t tru?c khi n?p b�i.`);
        return;
      }
    }

    stopTimer();
    try {
      await forceSave();
      
      // Submit to backend (this will set state to EVALUATING and queue a job)
      await interviewApi.submitInterview(sessionId || "", answers);
      
      // Let the page reload so useInterviewSession handles the EVALUATING polling state
      refetch();
    } catch {
      alert("C� l?i x?y ra khi n?p b�i. Vui l�ng th? l?i.");
    }
  }, [session?.questions, answeredIndices, stopTimer, forceSave, sessionId, answers, refetch]);

  useEffect(() => {
    submitRef.current = handleSubmit;
  }, [handleSubmit]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
        <p className="mt-4 text-slate-500 font-medium">Đang tải phòng phỏng vấn...</p>
      </div>
    );
  }

  if (isGenerating) {
    const isEvaluating = session?.status === 'EVALUATING' || !session; // approximate it
    return <InterviewLoadingScreen isEvaluating={isEvaluating} />;
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Không thể tải dữ liệu</h2>
          <p className="text-slate-500 mb-6">{error || 'Không tìm thấy phiên phỏng vấn.'}</p>
          <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl w-full">Về trang chủ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 flex flex-col">
      <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col gap-6">
        
        {/* Header Area */}
        <header className="bg-white rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="w-full sm:w-1/3">
            <ProgressBar total={totalQuestions} completed={answeredCount} />
          </div>
          
          <div className="flex flex-col items-center w-full sm:w-1/3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Thời gian còn lại</span>
            <div className={`text-3xl font-black font-mono tracking-tight transition-colors duration-300 ${progressRatio < 0.1 ? 'text-red-500 animate-pulse' : 'text-slate-800'}`}>
              {formattedTime}
            </div>
          </div>
          
          <div className="flex justify-end w-full sm:w-1/3 gap-3 items-center">
            {saveError ? (
              <span className="text-xs font-medium text-red-500">{saveError}</span>
            ) : isSaving ? (
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Đang lưu...
              </span>
            ) : (
              <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"></path></svg>
                Đã lưu
              </span>
            )}
            <button 
              onClick={() => handleSubmit(false)}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all shadow-lg shadow-slate-200 hover:-translate-y-0.5"
            >
              Nộp bài
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
          {/* Navigator Sidebar */}
          <aside className="w-full lg:w-72 bg-white rounded-3xl p-6 shadow-sm flex flex-col h-fit">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Danh sách câu hỏi</h3>
            <QuestionNavigator
              totalQuestions={totalQuestions}
              currentIndex={currentQuestionIndex}
              onSelectQuestion={setCurrentQuestionIndex}
              answeredIndices={answeredIndices}
            />
            
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                <div className="w-3 h-3 rounded-full bg-indigo-600 shadow-sm"></div> Đang chọn
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                <div className="w-3 h-3 rounded-full bg-emerald-50 border border-emerald-200"></div> Đã trả lời
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                <div className="w-3 h-3 rounded-full bg-white border border-slate-200"></div> Chưa trả lời
              </div>
            </div>
          </aside>

          {/* Question Display */}
          <main className="flex-1 min-h-[500px]">
            {currentQuestion ? (
              <QuestionCard
                key={currentQuestion.id || currentQuestion._id || currentQuestionIndex}
                question={currentQuestion}
                currentAnswer={currentAnswer}
                onAnswerChange={handleAnswerChange}
                index={currentQuestionIndex}
              />
            ) : (
              <div className="h-full bg-white/80 backdrop-blur-xl rounded-3xl border border-white/50 p-8 flex items-center justify-center">
                <p className="text-slate-500 font-medium">Vui lòng chọn câu hỏi từ danh sách.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};


