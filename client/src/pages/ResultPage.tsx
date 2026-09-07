import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { interviewApi } from '../services/api/interviewApi';
import type { InterviewSession } from '../features/InterviewRoom/types';
import { RadarScoreChart } from '../features/ResultScreen/components/RadarScoreChart';
import { FeedbackList } from '../features/ResultScreen/components/FeedbackList';
import { LearningPathView } from '../features/ResultScreen/components/LearningPathView';

export const ResultPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');

  useEffect(() => {
    const fetchResult = async () => {
      if (!sessionId) return;
      try {
        setIsLoading(true);
        const data = await interviewApi.fetchInterviewSession(sessionId);
        if (data.status !== 'COMPLETED') {
          // If not completed, maybe redirect to room
          navigate(`/interview/${sessionId}`);
          return;
        }
        setSession(data);
      } catch (err) {
        setError('Không thể tải kết quả đánh giá.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchResult();
  }, [sessionId, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
        <p className="mt-4 text-slate-500 font-medium">Đang tải kết quả đánh giá...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full">
          <h2 className="text-xl font-bold text-red-500 mb-2">Lỗi</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <Link to="/" className="px-6 py-2 bg-indigo-600 text-white rounded-xl">Về trang chủ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="bg-white rounded-3xl p-8 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 mb-2">Kết quả phỏng vấn</h1>
            <p className="text-slate-500">
              Vị trí: <span className="font-semibold text-slate-700">{session.setupData.jobPosition || 'Không rõ'}</span> - 
              Level: <span className="font-semibold text-slate-700">{session.setupData.level || 'Không rõ'}</span>
            </p>
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Điểm tổng quan</span>
            <div className="flex items-end gap-1">
              <span className="text-5xl font-black text-indigo-600">{session.overallScore ?? 'N/A'}</span>
              <span className="text-xl font-bold text-slate-400 mb-1">/10</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button 
                onClick={() => setLanguage('vi')}
                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${language === 'vi' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Tiếng Việt
              </button>
              <button 
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${language === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                English
              </button>
            </div>
            
            <Link to="/" className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all shadow-lg hover:-translate-y-0.5">
              Quay về trang chủ
            </Link>
          </div>
        </header>

        {/* Radar Chart & Learning Path Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
            <h3 className="text-xl font-bold text-slate-800 mb-4 text-center">Phân tích năng lực (Radar Chart)</h3>
            <div className="flex-1 flex items-center justify-center">
              <RadarScoreChart dimensions={session.dimensions || []} language={language} />
            </div>
          </div>
          <div className="flex flex-col">
            <LearningPathView learningPath={session.learningPath} language={language} />
          </div>
        </div>

        {/* Detailed Feedback Section */}
        <div>
          <h3 className="text-2xl font-bold text-slate-800 mb-6">Chi tiết nhận xét (Feedback)</h3>
          <FeedbackList questions={session.questions || []} language={language} />
        </div>

      </div>
    </div>
  );
};
