import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { LoginRequest } from '../../types/auth';

const LoginForm: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [formData, setFormData] = useState<LoginRequest>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Login failed. Please try again.');
    }
  };

  const features = [
    {
      icon: '📊',
      title: 'GST Compliant',
      description: 'GSTR reports automation'
    },
    {
      icon: '🧾',
      title: 'E-Invoice',
      description: 'IRP integrated'
    },
    {
      icon: '🔗',
      title: 'Integrations',
      description: 'Tally, Zoho & more'
    },
    {
      icon: '🏢',
      title: 'Multi-Tenant',
      description: 'Manage multiple clients'
    }
  ];

  const stats = [
    { number: '5K+', label: 'Users' },
    { number: '50L+', label: 'Invoices' },
    { number: '99.9%', label: 'Uptime' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-6xl flex bg-white rounded-xl shadow-xl overflow-hidden" style={{ height: '85vh', maxHeight: '650px' }}>

        {/* Left Column - Branding & Information */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 relative">
          <div className="absolute inset-0 bg-black opacity-5"></div>
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-500 rounded-full opacity-15 blur-3xl"></div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-500 rounded-full opacity-15 blur-3xl"></div>

          <div className="relative z-10 flex flex-col justify-between p-8 text-white w-full">
            <div>
              <div className="flex items-center space-x-2 mb-6">
                <div className="w-9 h-9 bg-white/20 backdrop-blur rounded flex items-center justify-center">
                  <span className="text-lg">📄</span>
                </div>
                <h1 className="text-xl font-bold">NexInvo</h1>
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    India's Trusted
                    <br />
                    GST Invoice Platform
                  </h2>
                  <p className="text-blue-100 text-sm">
                    Streamline invoicing & ensure GST compliance.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {features.map((feature, index) => (
                    <div key={index} className="bg-white/10 backdrop-blur rounded-lg p-3">
                      <div className="text-lg mb-1">{feature.icon}</div>
                      <h3 className="font-semibold text-sm">{feature.title}</h3>
                      <p className="text-xs text-blue-200">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex space-x-5">
                {stats.map((stat, index) => (
                  <div key={index}>
                    <div className="text-xl font-bold">{stat.number}</div>
                    <div className="text-blue-200 text-xs">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/20 pt-3">
                <div className="flex items-center space-x-2">
                  <span className="text-yellow-300 text-sm">★★★★★</span>
                  <span className="text-xs text-blue-200">4.8/5 rating</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Login Form */}
        <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
          <div className="w-full max-w-sm">

            {/* Mobile Logo */}
            <div className="lg:hidden mb-6 text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <div className="w-9 h-9 bg-blue-600 rounded flex items-center justify-center">
                  <span className="text-lg text-white">📄</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">NexInvo</h1>
              </div>
              <p className="text-sm text-gray-600">GST Invoice Platform</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-900">
                  Welcome Back
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Sign in to your account
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded text-sm">
                    <p className="text-red-700">{error}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-400 text-sm">📧</span>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="admin@nexinvo.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-400 text-sm">🔒</span>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Enter password"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <input
                      id="remember"
                      name="remember"
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="remember" className="ml-2 text-gray-700">
                      Remember me
                    </label>
                  </div>
                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                    onClick={() => alert('Password reset functionality coming soon!')}
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center px-4 py-3 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-white text-gray-500">Coming Soon</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled
                    className="flex justify-center items-center px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-400 bg-gray-50 cursor-not-allowed"
                  >
                    Google (Soon)
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex justify-center items-center px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-400 bg-gray-50 cursor-not-allowed"
                  >
                    Microsoft (Soon)
                  </button>
                </div>
              </form>

              <p className="text-xs text-center text-gray-600 mt-4">
                Don't have an account?{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                  onClick={() => alert('Registration feature coming soon!')}
                >
                  Sign up
                </button>
              </p>
            </div>

            {/* Quick Demo Access */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800 font-medium mb-1">🚀 Demo Access:</p>
              <div className="text-xs text-blue-700">
                <div>Email: <code className="bg-white px-1 py-0.5 rounded text-blue-800">admin@nexinvo.com</code></div>
                <div>Pass: <code className="bg-white px-1 py-0.5 rounded text-blue-800">admin123</code></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;