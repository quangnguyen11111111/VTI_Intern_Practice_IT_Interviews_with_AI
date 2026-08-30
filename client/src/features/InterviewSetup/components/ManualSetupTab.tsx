import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import type { BaseEntity } from '../../../services/api/interviewApi';
import type { ManualSetupFormData } from '../types';

interface ManualSetupTabProps {
  isLoading: boolean;
  roles: BaseEntity[];
  levels: BaseEntity[];
  technologies: BaseEntity[];
  onSubmit: (data: ManualSetupFormData) => void;
}

export const ManualSetupTab: React.FC<ManualSetupTabProps> = ({
  isLoading,
  roles,
  levels,
  technologies,
  onSubmit,
}) => {
  const form = useFormContext<ManualSetupFormData>();

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 animate-in fade-in duration-300">
      
      {/* Job Position (Role) */}
      <div className="group">
        <label htmlFor="jobPosition" className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">
          Chức danh ứng tuyển
        </label>
        <div className="relative">
          <select
            id="jobPosition"
            {...form.register('jobPosition', { required: 'Vui lòng chọn chức danh' })}
            className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-700 font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm outline-none appearance-none cursor-pointer"
            disabled={isLoading}
          >
            <option value="" disabled className="text-slate-400">-- Click để chọn chức danh của bạn --</option>
            {roles?.map((role) => (
              <option key={role._id} value={role._id}>
                {role.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-slate-400 group-hover:text-indigo-500 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
          </div>
        </div>
        {form.formState.errors.jobPosition && (
          <p className="mt-2 text-sm text-red-500 font-medium flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-red-500"></span> {form.formState.errors.jobPosition.message}
          </p>
        )}
      </div>

      {/* Level */}
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">
          Trình độ chuyên môn
        </label>
        <Controller
          name="level"
          control={form.control}
          rules={{ required: 'Vui lòng chọn cấp độ' }}
          render={({ field }) => (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {levels?.length > 0 ? levels.map((level) => {
                const isSelected = field.value === level._id;
                return (
                  <label 
                    key={level._id} 
                    className={`relative flex items-center justify-center p-4 rounded-2xl cursor-pointer transition-all duration-200 border-2 ${
                      isSelected 
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-[0_0_0_4px_rgba(79,70,229,0.1)]' 
                        : 'border-slate-100 bg-white hover:border-indigo-300 hover:bg-slate-50 shadow-sm'
                    }`}
                  >
                    <input
                      type="radio"
                      {...field}
                      value={level._id}
                      checked={isSelected}
                      className="sr-only"
                      disabled={isLoading}
                    />
                    <div className="text-center">
                      <span className={`block font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>
                        {level.name}
                      </span>
                    </div>
                    
                    {/* Check icon indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 text-indigo-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      </div>
                    )}
                  </label>
                );
              }) : (
                <p className="text-sm text-slate-400 italic">Dữ liệu cấp độ trống.</p>
              )}
            </div>
          )}
        />
        {form.formState.errors.level && (
          <p className="mt-2 text-sm text-red-500 font-medium flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-red-500"></span> {form.formState.errors.level.message}
          </p>
        )}
      </div>

      {/* Tech Stacks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
            Bộ kỹ năng & Công nghệ
          </label>
          <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-500 rounded-md">Chọn nhiều</span>
        </div>
        
        <Controller
          name="techStacks"
          control={form.control}
          render={({ field }) => (
            <div className="p-5 border-2 border-slate-100 rounded-2xl bg-slate-50/50 min-h-[120px]">
              {technologies?.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {technologies.map((tech) => {
                    const isSelected = field.value.includes(tech._id);
                    return (
                      <button
                        key={tech._id}
                        type="button"
                        onClick={() => {
                          const newValue = isSelected
                            ? field.value.filter((id: string) => id !== tech._id)
                            : [...field.value, tech._id];
                          field.onChange(newValue);
                        }}
                        disabled={isLoading}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
                          isSelected 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-105' 
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600 shadow-sm'
                        }`}
                      >
                        {tech.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-4">
                  <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                  <p className="text-sm font-medium">Vui lòng chọn chức danh để xem công nghệ tương ứng</p>
                </div>
              )}
            </div>
          )}
        />
      </div>

      {/* Submit action */}
      <div className="pt-8 mt-4">
        <button
          type="submit"
          disabled={isLoading}
          className={`relative w-full flex justify-center items-center px-8 py-4 rounded-2xl text-lg font-bold text-white transition-all overflow-hidden group ${
            isLoading 
              ? 'bg-slate-400 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5'
          }`}
        >
          {!isLoading && (
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          )}
          
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Đang thiết lập...
            </>
          ) : (
            <>
              Bắt Đầu Phỏng Vấn Ngay
              <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
