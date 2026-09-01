import React, { useState, useEffect } from 'react';
import type { Question } from '../types';

interface QuestionCardProps {
  question: Question;
  currentAnswer: string;
  onAnswerChange: (answer: string) => void;
  index: number;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  currentAnswer,
  onAnswerChange,
  index
}) => {
  const [lang, setLang] = useState<'vi' | 'en'>('vi');

  // Reset language to VI when question changes (optional UX choice, but good for consistency)
  useEffect(() => {
    setLang('vi');
  }, [question._id]);

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 p-6 sm:p-8 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
            Câu hỏi {index + 1}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
              question.difficulty.toLowerCase() === 'hard' ? 'bg-red-100 text-red-700' :
              question.difficulty.toLowerCase() === 'medium' ? 'bg-amber-100 text-amber-700' :
              'bg-emerald-100 text-emerald-700'
            }`}>
              {question.difficulty}
            </span>
            {question.category && (
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                {question.category}
              </span>
            )}
          </div>
        </div>
        
        <div className="bg-slate-100 p-1 rounded-lg inline-flex">
          <button
            onClick={() => setLang('vi')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${lang === 'vi' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            VI
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${lang === 'en' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            EN
          </button>
        </div>
      </div>

      <div className="prose prose-slate max-w-none mb-8">
        <p className="text-lg leading-relaxed text-slate-700 font-medium">
          {question.content[lang]}
        </p>
      </div>

      <div className="flex-1 flex flex-col min-h-[250px]">
        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider flex justify-between items-center">
          <span>Câu trả lời của bạn</span>
          {currentAnswer.length > 0 && (
            <span className="text-xs font-medium text-slate-400 capitalize normal-case">
              {currentAnswer.length} ký tự
            </span>
          )}
        </label>
        <textarea
          value={currentAnswer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Nhập câu trả lời của bạn tại đây..."
          className="flex-1 w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 sm:p-6 text-slate-700 text-base resize-none transition-all duration-200 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 placeholder:text-slate-400"
        />
      </div>
    </div>
  );
};
