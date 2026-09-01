import React from 'react';
import { useInterviewSetup } from './useInterviewSetup';
import { FormProvider } from 'react-hook-form';
import { SetupMode } from './types';
import { ManualSetupTab } from './components/ManualSetupTab';
import { JdUploadTab } from './components/JdUploadTab';

export const InterviewSetupForm: React.FC = () => {
  const {
    manualForm,
    jdForm,
    activeMode,
    setActiveMode,
    isLoading,
    isFetchingData,
    error,
    successMessage,
    sessionId,
    roles,
    levels,
    technologies,
    onSubmitManual,
    onSubmitJd,
  } = useInterviewSetup();

  return (
    <div className="max-w-3xl mx-auto p-8 sm:p-10 bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 relative overflow-hidden">
      {/* Subtle inner top glow */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent"></div>

      <div className="mb-10 text-center">
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Thiết Lập Phỏng Vấn</h2>
        <p className="text-slate-500 mt-2 font-medium">Vui lòng hoàn thiện hồ sơ hoặc tải lên JD để bắt đầu</p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-slate-100 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveMode(SetupMode.MANUAL)}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeMode === SetupMode.MANUAL
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            Tùy Chỉnh Thủ Công
          </button>
          <button
            type="button"
            onClick={() => setActiveMode(SetupMode.JD_UPLOAD)}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeMode === SetupMode.JD_UPLOAD
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            Tải Lên JD (Mới)
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50/80 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 animate-in fade-in zoom-in duration-300">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <p className="font-medium">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-8 p-4 bg-emerald-50/80 border border-emerald-100 rounded-2xl flex items-start gap-3 text-emerald-700 animate-in fade-in zoom-in duration-300">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {isFetchingData ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
          </div>
          <p className="text-slate-500 font-medium mt-4">Đang tải cấu hình hệ thống...</p>
        </div>
      ) : sessionId ? (
        <div className="py-12 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Sẵn Sàng Phỏng Vấn!</h3>
          <p className="text-slate-500 mb-8 max-w-md">
            Hệ thống đã chuẩn bị xong các câu hỏi dựa trên hồ sơ của bạn. Bạn có thể bắt đầu phiên phỏng vấn ngay bây giờ.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Thiết lập lại
            </button>
            <button
              onClick={() => {
                // Navigate to interview page (mocked for now)
                alert(`Chuyển hướng đến phiên phỏng vấn ID: ${sessionId}`);
              }}
              className="px-8 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
            >
              Bắt Đầu Phỏng Vấn
            </button>
          </div>
        </div>
      ) : (
        <>
          {activeMode === SetupMode.MANUAL ? (
            <FormProvider {...manualForm}>
              <ManualSetupTab
                isLoading={isLoading}
                roles={roles}
                levels={levels}
                technologies={technologies}
                onSubmit={onSubmitManual}
              />
            </FormProvider>
          ) : (
            <FormProvider {...jdForm}>
              <JdUploadTab
                isLoading={isLoading}
                onSubmit={onSubmitJd}
              />
            </FormProvider>
          )}
        </>
      )}
    </div>
  );
};
