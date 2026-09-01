import React from 'react';
import { useFormContext } from 'react-hook-form';
import type { JDUploadFormData } from '../types';

interface JdUploadTabProps {
  isLoading: boolean;
  onSubmit: (data: JDUploadFormData) => void;
}

export const JdUploadTab: React.FC<JdUploadTabProps> = ({ isLoading, onSubmit }) => {
  const form = useFormContext<JDUploadFormData>();
  const watchFile = form.watch('jdFile');
  const hasFile = watchFile && watchFile.length > 0;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 animate-in fade-in duration-300">
      
      {/* File Upload Area */}
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">
          Upload Job Description (JD)
        </label>
        <p className="text-sm text-slate-500 mb-4">
          Tải lên file JD (PDF, DOCX) của bạn. AI sẽ tự động phân tích và sinh ra các câu hỏi phỏng vấn phù hợp nhất.
        </p>
        
        <div className="relative">
          <input
            type="file"
            id="jdFile"
            accept=".pdf,.doc,.docx"
            {...form.register('jdFile', { required: 'Vui lòng chọn file JD' })}
            className="sr-only"
            disabled={isLoading}
          />
          <label
            htmlFor="jdFile"
            className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
              hasFile
                ? 'border-indigo-500 bg-indigo-50/50'
                : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-400'
            }`}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {hasFile ? (
                <>
                  <svg className="w-12 h-12 mb-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <p className="mb-2 text-sm font-semibold text-indigo-700">
                    Đã chọn file: {watchFile[0].name}
                  </p>
                  <p className="text-xs text-indigo-500 font-medium">Click để thay đổi file khác</p>
                </>
              ) : (
                <>
                  <svg className="w-10 h-10 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <p className="mb-2 text-sm text-slate-600 font-medium">
                    <span className="font-bold text-indigo-600">Click để tải lên</span> hoặc kéo thả file vào đây
                  </p>
                  <p className="text-xs text-slate-500">Hỗ trợ định dạng: PDF, DOCX (Tối đa 5MB)</p>
                </>
              )}
            </div>
          </label>
        </div>
        {form.formState.errors.jdFile && (
          <p className="mt-2 text-sm text-red-500 font-medium flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-red-500"></span> {form.formState.errors.jdFile.message as string}
          </p>
        )}
      </div>

      {/* Submit action */}
      <div className="pt-8 mt-4">
        <button
          type="submit"
          disabled={isLoading || !hasFile}
          className={`relative w-full flex justify-center items-center px-8 py-4 rounded-2xl text-lg font-bold text-white transition-all overflow-hidden group ${
            isLoading || !hasFile
              ? 'bg-slate-400 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5'
          }`}
        >
          {!isLoading && hasFile && (
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          )}
          
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Đang tải lên & phân tích...
            </>
          ) : (
            <>
              Phân Tích JD & Bắt Đầu Phỏng Vấn
              <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
