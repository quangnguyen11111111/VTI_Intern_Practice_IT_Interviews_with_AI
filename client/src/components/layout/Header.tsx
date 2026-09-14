import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../auth/authStore';
import { logout } from '../../auth/apiClient';

export const Header: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const navLinks = [
    { name: 'Trang chủ', path: '/' },
    { name: 'Phỏng vấn', path: '/setup' },
    { name: 'Lịch sử', path: '/history' },
    { name: 'Thống kê', path: '/analytics' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-indigo-600 text-white p-2 rounded-xl group-hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <span className="font-bold text-xl text-slate-900 tracking-tight">
                VTI <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">AI Interview</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* User Section / Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 focus:outline-none p-1 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <img
                    className="h-8 w-8 rounded-full object-cover border border-slate-200"
                    src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=e0e7ff&color=4f46e5`}
                    alt={user.fullName}
                  />
                  <span className="text-sm font-medium text-slate-700 truncate max-w-[120px]">
                    {user.fullName}
                  </span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg shadow-slate-200/50 border border-slate-100 py-1 z-50 animate-fade-in-up">
                    <Link
                      to="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                    >
                      Hồ sơ cá nhân
                    </Link>
                    {user.role === 'ADMIN' && (
                      <>
                        <div className="border-t border-slate-100 my-1"></div>
                        <Link
                          to="/admin/metrics"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                        >
                          Bảng điều khiển Admin
                        </Link>
                      </>
                    )}
                    <div className="border-t border-slate-100 my-1"></div>
                    <button
                      onClick={async () => {
                        setIsUserMenuOpen(false);
                        try {
                          await logout();
                        } finally {
                          navigate('/login');
                        }
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors px-3 py-2"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl shadow-sm shadow-indigo-200 transition-all hover:-translate-y-0.5"
                >
                  Đăng ký miễn phí
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-slate-500 hover:text-slate-700 focus:outline-none p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-md absolute w-full animate-fade-in-up shadow-xl shadow-slate-200/20">
          <div className="px-4 pt-2 pb-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMenuOpen(false)}
                className={`block px-3 py-3 rounded-lg text-base font-medium ${
                  isActive(link.path)
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {link.name}
              </Link>
            ))}
            
            <div className="border-t border-slate-200 my-2 pt-2">
              {user ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-3 py-3 rounded-lg text-base font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Hồ sơ cá nhân
                  </Link>
                  {user.role === 'ADMIN' && (
                    <Link
                      to="/admin/metrics"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-3 py-3 rounded-lg text-base font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Bảng điều khiển Admin
                    </Link>
                  )}
                  <button
                    onClick={async () => {
                      setIsMenuOpen(false);
                      try {
                        await logout();
                      } finally {
                        navigate('/login');
                      }
                    }}
                    className="block w-full text-left px-3 py-3 rounded-lg text-base font-medium text-red-600 hover:bg-red-50"
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Link
                    to="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex justify-center items-center px-4 py-2 rounded-xl text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex justify-center items-center px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Đăng ký
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
