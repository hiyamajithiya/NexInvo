import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { LoginRequest } from '../../types/auth';

const LoginForm: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [formData, setFormData] = useState<LoginRequest>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login(formData);
      // Login successful - the AuthProvider will handle the redirect
      console.log('Login successful');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || err.response?.data?.message || 'Login failed. Please try again.');
    }
  };

  const features = [
    {
      icon: '⚡',
      title: 'Lightning Fast',
      description: 'Process invoices in seconds'
    },
    {
      icon: '🛡️',
      title: 'Secure & Compliant',
      description: '100% GST compliant'
    },
    {
      icon: '📈',
      title: 'Real-time Analytics',
      description: 'Track business metrics'
    },
    {
      icon: '🔄',
      title: 'Seamless Integration',
      description: 'Connect with your tools'
    }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
        .float-animation { animation: float 6s ease-in-out infinite; }
        .slide-in-left { animation: slideInLeft 0.8s ease-out; }
        .slide-in-right { animation: slideInRight 0.8s ease-out; }
        .fade-in { animation: fadeIn 1s ease-out; }
        .pulse-animation { animation: pulse 3s ease-in-out infinite; }
        .gradient-shift {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          background-size: 200% 200%;
          animation: gradientShift 15s ease infinite;
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      <div className="w-full max-w-7xl flex bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ minHeight: '600px' }}>

        {/* Left Column - Branding & Information */}
        <div className="hidden lg:flex lg:w-1/2 gradient-shift relative overflow-hidden">
          {/* Animated background elements */}
          <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full pulse-animation"></div>
          <div className="absolute bottom-20 right-10 w-24 h-24 bg-white/10 rounded-full pulse-animation" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/3 w-20 h-20 bg-white/5 rounded-full pulse-animation" style={{ animationDelay: '2s' }}></div>

          {/* Geometric patterns */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full" style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(255,255,255,.05) 10px,
                rgba(255,255,255,.05) 20px
              )`
            }}></div>
          </div>

          <div className="relative z-10 flex flex-col justify-between p-10 text-white w-full">
            <div className={mounted ? 'slide-in-left' : 'opacity-0'}>
              <div className="flex items-center space-x-3 mb-8">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center float-animation">
                  <span className="text-2xl">⚡</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">NexInvo</h1>
                  <p className="text-xs text-purple-200 uppercase tracking-wider">Enterprise Edition</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h2 className="text-4xl font-bold mb-3 leading-tight">
                    Revolutionize Your
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300">
                      Invoice Management
                    </span>
                  </h2>
                  <p className="text-purple-100 text-base leading-relaxed">
                    Enterprise-grade GST compliance platform trusted by thousands of businesses across India.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {features.map((feature, index) => (
                    <div
                      key={index}
                      className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105 cursor-pointer"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="text-2xl mb-2">{feature.icon}</div>
                      <h3 className="font-bold text-sm mb-1">{feature.title}</h3>
                      <p className="text-xs text-purple-200 leading-relaxed">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={mounted ? 'fade-in' : 'opacity-0'}>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">Trusted by Industry Leaders</span>
                  <div className="flex -space-x-2">
                    {['🏢', '🏭', '🏦', '🏨'].map((emoji, i) => (
                      <div key={i} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/30">
                        <span className="text-sm">{emoji}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 bg-white/20 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full" style={{ width: '96%' }}></div>
                  </div>
                  <span className="text-sm font-bold">96% Success Rate</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Login Form */}
        <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-gray-100">
          <div className={`w-full max-w-md ${mounted ? 'slide-in-right' : 'opacity-0'}`}>

            {/* Mobile Logo */}
            <div className="lg:hidden mb-6 text-center">
              <div className="flex items-center justify-center space-x-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl">⚡</span>
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">NexInvo</h1>
              </div>
              <p className="text-sm text-gray-600">Enterprise Invoice Platform</p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">
                  Welcome Back
                </h2>
                <p className="text-gray-500">
                  Enter your credentials to access your dashboard
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg fade-in">
                    <div className="flex items-center">
                      <span className="text-red-500 mr-2">⚠️</span>
                      <p className="text-red-700 text-sm font-medium">{error}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="block w-full pl-11 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm transition-all duration-200 hover:border-gray-300"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                    Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="block w-full pl-11 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm transition-all duration-200 hover:border-gray-300"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember"
                      name="remember"
                      type="checkbox"
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="remember" className="ml-2 text-sm text-gray-600 cursor-pointer select-none">
                      Keep me signed in
                    </label>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                    onClick={() => alert('Password reset functionality coming soon!')}
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative overflow-hidden group flex justify-center items-center px-6 py-3.5 text-base font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg hover:shadow-xl"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  {isLoading ? (
                    <span className="relative flex items-center">
                      <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Authenticating...
                    </span>
                  ) : (
                    <span className="relative flex items-center">
                      Sign In
                      <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  )}
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-white text-gray-400 uppercase tracking-wider font-medium">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="relative group flex justify-center items-center px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-500 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                    onClick={() => alert('Google sign-in coming soon!')}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </button>
                  <button
                    type="button"
                    className="relative group flex justify-center items-center px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-500 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                    onClick={() => alert('Microsoft sign-in coming soon!')}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 23 23">
                      <path fill="#f35325" d="M0 0h11v11H0z"/>
                      <path fill="#81bc06" d="M12 0h11v11H12z"/>
                      <path fill="#05a6f0" d="M0 12h11v11H0z"/>
                      <path fill="#ffba08" d="M12 12h11v11H12z"/>
                    </svg>
                    Microsoft
                  </button>
                </div>
              </form>

              <p className="text-sm text-center text-gray-600 mt-6">
                Don't have an account?{' '}
                <button
                  type="button"
                  className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors hover:underline"
                  onClick={() => alert('Registration feature coming soon!')}
                >
                  Create free account
                </button>
              </p>
            </div>

            {/* Quick Demo Access */}
            <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 fade-in">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white text-sm">🔑</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Quick Demo Access</p>
                  <p className="text-xs text-gray-600">Use these credentials to explore</p>
                </div>
              </div>
              <div className="bg-white/70 backdrop-blur rounded-lg p-2 mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Email:</span>
                  <code className="bg-indigo-100 px-2 py-1 rounded text-indigo-700 font-mono">admin@nexinvo.com</code>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Password:</span>
                  <code className="bg-indigo-100 px-2 py-1 rounded text-indigo-700 font-mono">admin123</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;