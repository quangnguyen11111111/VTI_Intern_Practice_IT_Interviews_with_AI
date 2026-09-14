import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../auth/authStore';

export const HomePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex flex-col w-full selection:bg-indigo-500 selection:text-white">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-2xl mb-8 shadow-sm border border-indigo-100 transform hover:scale-105 transition-transform animate-fade-in-up">
          <span className="text-indigo-600 font-semibold text-sm px-2">✨ Phiên bản Mới Nhất</span>
        </div>
        
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight sm:text-6xl lg:text-7xl mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <span className="block">Phỏng Vấn IT Thông Minh</span>
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 mt-2 bg-300% animate-gradient">
            Với Trí Tuệ Nhân Tạo
          </span>
        </h1>
        
        <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto font-medium animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          Trải nghiệm môi trường phỏng vấn sát thực tế, nhận phản hồi chi tiết từ AI và nâng cao cơ hội trúng tuyển vào các công ty công nghệ hàng đầu.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <Link
            to="/setup"
            className="inline-flex justify-center items-center px-8 py-4 rounded-xl text-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-1 transition-all group relative overflow-hidden"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            Bắt đầu phỏng vấn ngay
            <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </Link>
          
          <Link
            to={user ? '/history' : '/register'}
            className="inline-flex justify-center items-center px-8 py-4 rounded-xl text-lg font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm hover:shadow hover:-translate-y-0.5 transition-all"
          >
            {user ? 'Xem lịch sử' : 'Đăng ký miễn phí'}
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Tại sao chọn VTI AI Interview?</h2>
            <p className="mt-4 text-lg text-slate-600">Những tính năng vượt trội giúp bạn chuẩn bị tốt nhất cho buổi phỏng vấn thực tế.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:shadow-xl hover:shadow-indigo-100/50 transition-all hover:-translate-y-1 group">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 transition-colors">
                <svg className="w-7 h-7 text-indigo-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Đánh giá đa chiều</h3>
              <p className="text-slate-600">
                AI phân tích câu trả lời dựa trên kỹ năng chuyên môn, kỹ năng giải quyết vấn đề và kỹ năng giao tiếp.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:shadow-xl hover:shadow-indigo-100/50 transition-all hover:-translate-y-1 group">
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors">
                <svg className="w-7 h-7 text-purple-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Mô phỏng thực tế</h3>
              <p className="text-slate-600">
                Bộ câu hỏi được sinh ra động (dynamic) dựa trên Job Description (JD) thực tế của các doanh nghiệp.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:shadow-xl hover:shadow-indigo-100/50 transition-all hover:-translate-y-1 group">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
                <svg className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Lộ trình học tập</h3>
              <p className="text-slate-600">
                Nhận đề xuất cải thiện cụ thể sau mỗi lần phỏng vấn, giúp bạn lấp đầy lỗ hổng kiến thức nhanh chóng.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Cách thức hoạt động</h2>
            <p className="mt-4 text-lg text-slate-600">Chỉ với 3 bước đơn giản để trải nghiệm công nghệ AI.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-indigo-100 z-0"></div>
            
            {/* Step 1 */}
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-white rounded-full border-4 border-indigo-100 flex items-center justify-center mb-6 shadow-md shadow-indigo-100">
                <span className="text-3xl font-bold text-indigo-600">1</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Tạo phòng phỏng vấn</h3>
              <p className="text-slate-600">Cung cấp Job Description (JD) hoặc tùy chọn level kỹ năng mong muốn.</p>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-white rounded-full border-4 border-indigo-100 flex items-center justify-center mb-6 shadow-md shadow-indigo-100">
                <span className="text-3xl font-bold text-indigo-600">2</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Tham gia trả lời</h3>
              <p className="text-slate-600">Hệ thống AI sẽ đặt câu hỏi và bạn trả lời như trong một buổi phỏng vấn thật.</p>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-white rounded-full border-4 border-indigo-100 flex items-center justify-center mb-6 shadow-md shadow-indigo-100">
                <span className="text-3xl font-bold text-indigo-600">3</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Nhận kết quả</h3>
              <p className="text-slate-600">Nhận báo cáo chi tiết, điểm số và gợi ý học tập từ AI ngay lập tức.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-indigo-600 relative overflow-hidden">
        {/* Background Patterns */}
        <div className="absolute inset-0 opacity-10">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="pattern-circles" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="2" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pattern-circles)" />
          </svg>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl mb-6">
            Sẵn sàng để bắt đầu hành trình của bạn?
          </h2>
          <p className="text-indigo-100 text-lg mb-10 max-w-2xl mx-auto">
            Gia nhập cùng hàng ngàn ứng viên khác đang sử dụng hệ thống của chúng tôi để chuẩn bị cho cơ hội nghề nghiệp tiếp theo.
          </p>
          <Link
            to="/register"
            className="inline-flex justify-center items-center px-8 py-4 rounded-xl text-lg font-bold text-indigo-600 bg-white hover:bg-indigo-50 shadow-lg hover:-translate-y-1 transition-all"
          >
            Tạo tài khoản miễn phí
          </Link>
        </div>
      </section>
    </div>
  );
};
