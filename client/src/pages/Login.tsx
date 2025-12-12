import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import logoIcon from '../assets/capytech-fav.png';
import { Loader2 } from 'lucide-react';
// ✅ Import the animation and AnimatePresence
import PortalTransition from '../components/PortalTransition';
import { AnimatePresence } from 'framer-motion';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // ✅ New state to trigger the animation
  const [showPortal, setShowPortal] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Helper to handle successful login sequence
  const handleLoginSuccess = (token: string, user: any) => {
    // Prevent double trigger if already showing portal
    if (showPortal) return; 

    login(token, user);
    setShowPortal(true);
};

  // --- 1. HANDLE SSO REDIRECT ---
  useEffect(() => {
    const token = searchParams.get('token');
    const errorMsg = searchParams.get('error');

    if (token && !showPortal) {
        const fetchUserAndLogin = async () => {
            try {
                client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                const { data: user } = await client.get('/auth/me');
                // ✅ Use the helper
                handleLoginSuccess(token, user);
            } catch (err) {
                setError("Failed to verify SSO token");
            }
        };
        fetchUserAndLogin();
    }
    
    if (errorMsg) {
        setError(decodeURIComponent(errorMsg));
    }
  }, [searchParams, login]); // Removed navigate from dependency

  // --- 2. TRIGGER SSO ---
  const handleSSOLogin = () => {
      window.location.href = 'http://localhost:5000/api/auth/google';
  };

  // --- 3. NORMAL LOGIN ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const { data } = await client.post('/auth/login', { 
        email, 
        password,
        keepLoggedIn,
      });
      // ✅ Use the helper
      handleLoginSuccess(data.token, data.user);
      
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
      setIsLoading(false);
    } 
    // Note: We don't set isLoading(false) on success, so the form stays disabled during animation
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#1A1D21] via-[#2A5691] to-[#1A1D21]">
      
      {/* ✅ The Portal Animation Overlay */}
      <AnimatePresence>
        {showPortal && (
            <PortalTransition onComplete={() => navigate('/')} />
        )}
      </AnimatePresence>

      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] h-96 w-96 rounded-full bg-gradient-to-br from-[#3B73B9]/30 to-[#06D6A0]/20 blur-3xl animate-pulse" style={{animationDuration: '4s'}}></div>
        <div className="absolute bottom-[-10%] right-[-5%] h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-[#FFD166]/20 to-[#5A8ED1]/30 blur-3xl animate-pulse" style={{animationDuration: '6s', animationDelay: '1s'}}></div>
      </div>

      <div className={`relative z-10 w-full max-w-md px-4 transition-all duration-700 ${showPortal ? 'scale-90 opacity-0 blur-sm' : 'scale-100 opacity-100'}`}>
        {/* CapyTech Logo Header */}
        <div className="mb-10 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#3B73B9] to-[#06D6A0] blur-xl opacity-50"></div>
            <div className="relative flex items-center gap-3 rounded-2xl bg-white/10 px-6 py-3 backdrop-blur-sm border border-white/20">
              <div className="h-8 w-8 flex items-center justify-center">
                <span><img src={logoIcon} alt="Logo" className="object-contain"/></span>
              </div>
              <span className="text-2xl font-bold text-white">CAPYDAM</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
          <div className="relative">
            <h1 className="mb-2 text-3xl font-bold text-white text-center">Welcome back</h1>
            <p className="mb-6 text-sm text-white/70 text-center">Access the internal asset library</p>
            
            {error && (
              <div className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200 text-center">
                {error}
              </div>
            )}

            {/* Animated SSO Button */}
            <button
                onClick={handleSSOLogin}
                type="button"
                disabled={isLoading || showPortal}
                className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/5 p-3 transition-all duration-500 hover:bg-white hover:text-black hover:shadow-xl active:scale-[0.98] overflow-hidden disabled:opacity-50"
            >
                {/* Icon Container */}
                <div className="relative h-6 w-6 flex items-center justify-center">
                    
                    {/* 1. Google Icon */}
                    <div className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out group-hover:opacity-0 group-hover:rotate-180 group-hover:scale-50">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white p-0.5 shadow-sm">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                        </div>
                    </div>

                    {/* 2. CapyTech Logo */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-50 rotate-[-180deg] transition-all duration-500 ease-out group-hover:opacity-100 group-hover:scale-125 group-hover:rotate-0">
                        <img src={logoIcon} alt="CapyTech" className="h-full w-full object-contain drop-shadow-md" />
                    </div>

                </div>
                
                <span className="font-semibold text-white/90 group-hover:text-black transition-colors duration-300">Log in with Capytech</span>
            </button>

            <div className="relative flex items-center py-6">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-xs font-bold text-white/40 uppercase tracking-widest">Or via email</span>
                <div className="flex-grow border-t border-white/10"></div>
            </div>

            {/* EMAIL FORM */}
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* ... (Email and Password fields - no changes here) ... */}
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-white/90">Email Address</label>
                <div className={`relative transition-all duration-300 ${focusedField === 'email' ? 'scale-[1.01]' : ''}`}>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className="h-12 w-full rounded-xl border border-white/20 bg-white/5 px-4 text-sm text-white placeholder-white/40 backdrop-blur-sm transition-all duration-300 focus:border-[#3B73B9] focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#3B73B9]/50 hover:bg-white/8"
                    placeholder="admin@capytech.com"
                    required
                    disabled={isLoading || showPortal}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-white/90">Password</label>
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
                    disabled={isLoading || showPortal}
                  />
                </div>
              </div>

              <div className="flex items-center pt-2">
                <input
                  id="keepLoggedIn"
                  type="checkbox"
                  checked={keepLoggedIn}
                  onChange={(e) => setKeepLoggedIn(e.target.checked)}
                  className="h-5 w-5 cursor-pointer rounded-md border-2 border-white/30 bg-white/5 text-[#3B73B9] transition-all duration-200"
                  disabled={isLoading || showPortal}
                />
                <label htmlFor="keepLoggedIn" className="ml-3 cursor-pointer text-sm font-medium text-white/90 hover:text-white">Keep me logged in</label>
              </div>

              <button
                type="submit"
                disabled={isLoading || showPortal}
                className="group relative h-12 w-full overflow-hidden rounded-full bg-gradient-to-r from-[#3B73B9] to-[#5A8ED1] px-6 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(59,115,185,0.6)] disabled:opacity-50"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Log in'}
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;