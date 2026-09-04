import React from 'react';

interface QuestionNavigatorProps {
  totalQuestions: number;
  currentIndex: number;
  onSelectQuestion: (index: number) => void;
  answeredIndices: Set<number>;
}

export const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  totalQuestions,
  currentIndex,
  onSelectQuestion,
  answeredIndices
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: totalQuestions }).map((_, index) => {
        const isCurrent = index === currentIndex;
        const isAnswered = answeredIndices.has(index);

        let baseClass = "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-200 border-2 outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 ";
        
        if (isCurrent) {
          baseClass += "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-110 z-10";
        } else if (isAnswered) {
          baseClass += "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300";
        } else {
          baseClass += "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300";
        }

        return (
          <button
            key={index}
            onClick={() => onSelectQuestion(index)}
            className={baseClass}
            aria-label={`Câu hỏi ${index + 1}`}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );
};
