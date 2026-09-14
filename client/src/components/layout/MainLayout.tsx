import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';

export const MainLayout: React.FC = () => {
  const location = useLocation();
  
  // Kiểm tra xem có đang ở trong phòng phỏng vấn không
  // Nếu ở trong phòng phỏng vấn, không hiển thị Header và Footer để tối đa không gian
  const isInterviewRoom = location.pathname.match(/^\/interview\/[a-f0-9]{24}$/i);

  if (isInterviewRoom) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        <main className="flex-grow flex flex-col">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Header />
      <main className="flex-grow flex flex-col">
        {/* Decorative elements for all pages */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
          <div className="absolute top-40 -left-40 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
        </div>
        
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
