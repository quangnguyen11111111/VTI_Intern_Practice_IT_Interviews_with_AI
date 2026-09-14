import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-50 border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <Link to="/" className="flex items-center gap-2 group mb-4">
              <div className="bg-indigo-600 text-white p-2 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <span className="font-bold text-xl text-slate-900 tracking-tight">
                VTI <span className="text-indigo-600">AI Interview</span>
              </span>
            </Link>
            <p className="text-slate-500 text-sm max-w-sm">
              Hệ thống mô phỏng phỏng vấn IT thông minh với Trí Tuệ Nhân Tạo. Nâng cao kỹ năng và sự tự tin của bạn trước nhà tuyển dụng thực tế.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Liên kết nhanh</h3>
            <ul className="space-y-3">
              <li><Link to="/" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Trang chủ</Link></li>
              <li><Link to="/setup" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Phỏng vấn ngay</Link></li>
              <li><Link to="/history" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Lịch sử</Link></li>
              <li><Link to="/analytics" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Thống kê</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Hỗ trợ</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Hướng dẫn sử dụng</a></li>
              <li><a href="#" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Câu hỏi thường gặp</a></li>
              <li><a href="#" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Chính sách bảo mật</a></li>
              <li><a href="#" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Điều khoản dịch vụ</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            &copy; {currentYear} VTI Academy. All rights reserved.
          </p>
          <div className="flex gap-4">
            <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors">
              <span className="sr-only">Facebook</span>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
              </svg>
            </a>
            <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors">
              <span className="sr-only">GitHub</span>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
