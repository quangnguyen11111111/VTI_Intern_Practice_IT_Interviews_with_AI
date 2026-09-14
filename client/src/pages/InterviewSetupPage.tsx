import React from 'react';
import { Link } from 'react-router-dom';
import { InterviewSetupForm } from '../features/InterviewSetup';

export const InterviewSetupPage: React.FC = () => {
  return (
    <div className="w-full flex-grow py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Breadcrumbs */}
      <nav className="flex mb-6 text-sm font-medium text-slate-500" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-3">
          <li className="inline-flex items-center">
            <Link to="/" className="inline-flex items-center hover:text-indigo-600 transition-colors">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              Trang chủ
            </Link>
          </li>
          <li>
            <div className="flex items-center">
              <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="ml-1 md:ml-2 text-slate-700 font-semibold">Thiết lập phỏng vấn</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Page Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          Thiết lập phòng phỏng vấn
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Cấu hình thông tin JD hoặc chọn kỹ năng để bắt đầu mô phỏng phỏng vấn thực tế với AI.
        </p>
      </header>
      
      {/* Form Container */}
      <div className="animate-fade-in-up">
        <InterviewSetupForm />
      </div>
    </div>
  );
};
