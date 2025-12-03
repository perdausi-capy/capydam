import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import logoIcon from '../assets/capytech-fav.png'
 

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await client.post('/auth/login', { 
        email, 
        password,
        keepLoggedIn,
        // timezone 
      });
      login(data.token, data.user);
      navigate('/');
      // toast.success("Welcome back!");
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
      // toast.error("Invalid Credentials");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#1A1D21] via-[#2A5691] to-[#1A1D21]">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating Gradient Blobs */}
        <div className="absolute top-[-10%] left-[-5%] h-96 w-96 rounded-full bg-gradient-to-br from-[#3B73B9]/30 to-[#06D6A0]/20 blur-3xl animate-pulse" style={{animationDuration: '4s'}}></div>
        <div className="absolute bottom-[-10%] right-[-5%] h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-[#FFD166]/20 to-[#5A8ED1]/30 blur-3xl animate-pulse" style={{animationDuration: '6s', animationDelay: '1s'}}></div>
        <div className="absolute top-[40%] right-[20%] h-64 w-64 rounded-full bg-gradient-to-br from-[#06D6A0]/20 to-[#3B73B9]/20 blur-2xl animate-pulse" style={{animationDuration: '5s', animationDelay: '2s'}}></div>
        
        {/* Noise Texture Overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")'}}></div>
      </div>

      {/* Main Login Container */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo with Glow Effect */}
        <div className="mb-12 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#3B73B9] to-[#06D6A0] blur-xl opacity-50"></div>
            <div className="relative flex items-center gap-3 rounded-2xl bg-white/10 px-6 py-3 backdrop-blur-sm border border-white/20">
              <div className="h-8 w-8 flex items-center justify-center">
                <span><img src={logoIcon} alt="AI DAM Logo"/></span>
              </div>
              <span className="text-2xl font-bold text-white">CAPYDAM</span>
            </div>
          </div>
        </div>

        {/* Glassmorphic Login Card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:shadow-[0_0_40px_rgba(59,115,185,0.3)]">
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          
          <div className="relative">
            <h1 className="mb-2 text-3xl font-bold text-white">Welcome back</h1>
            <p className="mb-8 text-sm text-white/70">Enter your credentials to access your account</p>
            
            {error && (
              <div className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200 backdrop-blur-sm">
                {error}
              </div>
            )}

            <div className="space-y-5" onSubmit={handleSubmit}>
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-white/90">
                  Email Address
                </label>
                <div className={`relative transition-all duration-300 ${focusedField === 'email' ? 'scale-[1.01]' : ''}`}>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className="h-12 w-full rounded-xl border border-white/20 bg-white/5 px-4 text-sm text-white placeholder-white/40 backdrop-blur-sm transition-all duration-300 focus:border-[#3B73B9] focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#3B73B9]/50 hover:bg-white/8"
                    placeholder="admin@dam.local"
                    required
                    disabled={isLoading}
                  />
                  {focusedField === 'email' && (
                    <div className="absolute inset-0 -z-10 rounded-xl bg-[#3B73B9]/20 blur-lg"></div>
                  )}
                </div>
              </div>
              
              {/* Password Field */}
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-white/90">
                  Password
                </label>
                <div className={`relative transition-all duration-300 ${focusedField === 'password' ? 'scale-[1.01]' : ''}`}>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="h-12 w-full rounded-xl border border-white/20 bg-white/5 px-4 text-sm text-white placeholder-white/40 backdrop-blur-sm transition-all duration-300 focus:border-[#3B73B9] focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#3B73B9]/50 hover:bg-white/8"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                  />
                  {focusedField === 'password' && (
                    <div className="absolute inset-0 -z-10 rounded-xl bg-[#3B73B9]/20 blur-lg"></div>
                  )}
                </div>
              </div>

              {/* Timezone Dropdown */}
              {/* <div>
                <label htmlFor="timezone" className="mb-2 block text-sm font-semibold text-white/90">
                  Timezone
                </label>
                <div className={`relative transition-all duration-300 ${focusedField === 'timezone' ? 'scale-[1.01]' : ''}`}>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    // onFocus={() => setFocusedField('timezone')}
                    onBlur={() => setFocusedField(null)}
                    className="h-12 w-full rounded-xl border border-white/20 bg-white/5 px-4 text-sm text-white backdrop-blur-sm transition-all duration-300 focus:border-[#3B73B9] focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#3B73B9]/50 hover:bg-white/8"
                    disabled={isLoading}
                  >
                    <option value="UTC" className="bg-[#2A3441] text-white">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York" className="bg-[#2A3441] text-white">Eastern Time (ET)</option>
                    <option value="America/Chicago" className="bg-[#2A3441] text-white">Central Time (CT)</option>
                    <option value="America/Denver" className="bg-[#2A3441] text-white">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles" className="bg-[#2A3441] text-white">Pacific Time (PT)</option>
                    <option value="Europe/London" className="bg-[#2A3441] text-white">London (GMT)</option>
                    <option value="Europe/Paris" className="bg-[#2A3441] text-white">Central European Time (CET)</option>
                    <option value="Asia/Tokyo" className="bg-[#2A3441] text-white">Tokyo (JST)</option>
                    <option value="Asia/Shanghai" className="bg-[#2A3441] text-white">China Standard Time (CST)</option>
                    <option value="Australia/Sydney" className="bg-[#2A3441] text-white">Sydney (AEDT)</option>
                  </select>
                  {focusedField === 'timezone' && (
                    <div className="absolute inset-0 -z-10 rounded-xl bg-[#3B73B9]/20 blur-lg"></div>
                  )}
                </div>
              </div> */}

              {/* Keep me logged in */}
              <div className="flex items-center pt-2">
                <input
                  id="keepLoggedIn"
                  type="checkbox"
                  checked={keepLoggedIn}
                  onChange={(e) => setKeepLoggedIn(e.target.checked)}
                  className="h-5 w-5 cursor-pointer rounded-md border-2 border-white/30 bg-white/5 text-[#3B73B9] transition-all duration-200 focus:ring-2 focus:ring-[#3B73B9]/50 focus:ring-offset-0 hover:border-[#3B73B9]"
                  disabled={isLoading}
                />
                <label htmlFor="keepLoggedIn" className="ml-3 cursor-pointer text-sm font-medium text-white/90 transition-colors hover:text-white">
                  Keep me logged in
                </label>
              </div>

              {/* Login Button with Glow Effect */}
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="group relative h-12 w-full overflow-hidden rounded-full bg-gradient-to-r from-[#3B73B9] to-[#5A8ED1] px-6 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(59,115,185,0.6)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#5A8ED1] to-[#06D6A0] opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Logging in...
                    </>
                  ) : (
                    <>
                      Log in
                      <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </div>

            {/* Secondary Links */}
            {/* <div className="mt-8 space-y-3 border-t border-white/10 pt-6 text-center text-sm">
              <Link to="/forgot-password" className="block font-medium text-white/70 transition-all duration-200 hover:text-[#FFD166]">
                Forgot password?
              </Link>
              <Link to="/request-account" className="block font-medium text-white/70 transition-all duration-200 hover:text-[#06D6A0]">
                Request an account
              </Link>
            </div> */}
          </div>
        </div>

        {/* Bottom Decoration */}
        <div className="mt-8 text-center">
          <p className="text-xs text-white/50">© 2024 AI CAPYTECH DAM. Secure • Reliable • Fast</p>
        </div>
      </div>
    </div>
  );
};

export default Login;