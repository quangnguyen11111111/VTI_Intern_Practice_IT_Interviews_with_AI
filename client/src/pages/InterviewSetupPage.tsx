import React from 'react';
import { InterviewSetupForm } from '../features/InterviewSetup';

export const InterviewSetupPage: React.FC = () => {
  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 selection:bg-indigo-500 selection:text-white">
      {/* Decorative blurred backgrounds */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-4000"></div>

      <div className="relative z-10 min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-3xl text-center">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-6 shadow-sm border border-indigo-50">
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl lg:text-6xl mb-4">
            <span className="block">VTI AI Interview</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Master Your Skills</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto font-medium">
            Thiết lập cấu hình kỹ năng và bắt đầu trải nghiệm phỏng vấn mô phỏng chuyên nghiệp với Trí Tuệ Nhân Tạo.
          </p>
        </div>
        
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-3xl">
          <InterviewSetupForm />
        </div>
      </div>
    </div>
  );
};
