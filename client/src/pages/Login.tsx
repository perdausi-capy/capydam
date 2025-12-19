import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import logoIcon from '../assets/capytech-fav.png';
import { Loader2, Mail, Lock, ArrowRight, Check } from 'lucide-react';
import PortalTransition from '../components/PortalTransition';
import { AnimatePresence, motion } from 'framer-motion';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [showPortal, setShowPortal] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // --- LOGIC: Handle Login Success ---
  const handleLoginSuccess = (token: string, user: any) => {
    if (showPortal) return; 
    login(token, user);
    setShowPortal(true);
  };

  // --- LOGIC: SSO Redirect Handling ---
  useEffect(() => {
    const token = searchParams.get('token');
    const errorMsg = searchParams.get('error');

    if (token && !showPortal) {
        const fetchUserAndLogin = async () => {
            try {
                client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                const { data: user } = await client.get('/auth/me');
                handleLoginSuccess(token, user);
            } catch (err) {
                setError("Failed to verify SSO token");
            }
        };
        fetchUserAndLogin();
    }
    
    if (errorMsg) setError(decodeURIComponent(errorMsg));
  }, [searchParams, login]); 

  // --- LOGIC: Trigger SSO ---
  const handleSSOLogin = () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      window.location.href = `${apiUrl}/auth/google`;
  };

  // --- LOGIC: Submit Normal Login ---
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
      handleLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
      setIsLoading(false);
    } 
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0B0D0F] flex items-center justify-center p-4 relative overflow-hidden font-sans text-gray-900 dark:text-white transition-colors duration-500">
      
      {/* 🌌 PORTAL TRANSITION OVERLAY */}
      <AnimatePresence>
        {showPortal && (
            <PortalTransition onComplete={() => navigate('/')} />
        )}
      </AnimatePresence>

      {/* 🌟 AMBIENT BACKGROUND GLOW */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-indigo-400/20 dark:bg-indigo-600/20 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-normal" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-400/20 dark:bg-blue-600/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-normal" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`w-full max-w-md relative z-10 transition-all duration-700 ${showPortal ? 'scale-90 opacity-0 blur-sm' : 'scale-100 opacity-100'}`}
      >
        
        {/* LOGO AREA (No Background Box) */}
        <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
                <img 
                    src={logoIcon} 
                    alt="Logo" 
                    className="w-18 h-18 object-contain drop-shadow-2xl hover:scale-110 transition-transform duration-500"
                />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-gray-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:via-gray-200 dark:to-gray-500">
                Welcome Back
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Access the internal asset library</p>
        </div>

        {/* GLASS CARD */}
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 p-8 rounded-3xl shadow-2xl dark:shadow-none relative">
            
            {/* ERROR MESSAGE */}
            {error && (
              <div className="mb-6 rounded-xl border border-red-500/20 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-200 text-center flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400 animate-pulse" />
                {error}
              </div>
            )}

            {/* ✅ ANIMATED SSO BUTTON */}
            <button
                onClick={handleSSOLogin}
                type="button"
                disabled={isLoading || showPortal}
                className="group w-full relative flex items-center justify-center gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0B0D0F]/50 p-4 transition-all duration-300 hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-lg dark:hover:shadow-[0_0_25px_rgba(59,130,246,0.25)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 mb-8 overflow-hidden shadow-sm"
            >
                {/* Hover Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-600/20 dark:to-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Icon Container relative to button */}
                <div className="relative h-6 w-6">
                    {/* 1. GOOGLE ICON */}
                    <svg className="absolute inset-0 w-full h-full transition-all duration-500 ease-in-out group-hover:-translate-y-8 group-hover:opacity-0" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>

                    {/* 2. CAPYTECH LOGO */}
                    <img 
                        src={logoIcon} 
                        alt="CapyTech Logo" 
                        className="absolute inset-0 w-full h-full object-contain transition-all duration-500 ease-in-out translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                    />
                </div>

                <span className="font-bold relative z-10 text-gray-700 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-100 transition-colors">
                    Log in with Capytech
                </span>
            </button>

            <div className="relative flex items-center mb-8">
                <div className="flex-grow border-t border-gray-200 dark:border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Or via email</span>
                <div className="flex-grow border-t border-gray-200 dark:border-white/10"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Email Input */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Email</label>
                    <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors" size={18} />
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading || showPortal}
                            className="w-full bg-gray-50 dark:bg-[#0B0D0F]/50 border border-gray-200 dark:border-white/10 rounded-xl pl-11 pr-5 py-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 group-hover:border-blue-200 dark:group-hover:border-white/20"
                            placeholder="email@capytech.com"
                        />
                    </div>
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Password</label>
                    </div>
                    <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors" size={18} />
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading || showPortal}
                            className="w-full bg-gray-50 dark:bg-[#0B0D0F]/50 border border-gray-200 dark:border-white/10 rounded-xl pl-11 pr-5 py-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 group-hover:border-blue-200 dark:group-hover:border-white/20"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                {/* Keep Logged In Checkbox */}
                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${keepLoggedIn ? 'bg-blue-600 border-blue-600' : 'bg-white dark:bg-transparent border-gray-300 dark:border-white/30 group-hover:border-blue-400 dark:group-hover:border-white/50'}`}>
                        {keepLoggedIn && <Check size={12} className="text-white" />}
                    </div>
                    <input 
                        type="checkbox" 
                        className="hidden"
                        checked={keepLoggedIn}
                        onChange={(e) => setKeepLoggedIn(e.target.checked)}
                        disabled={isLoading || showPortal}
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white transition-colors">Keep me logged in</span>
                </label>

                {/* Submit Button */}
                <button 
                    type="submit" 
                    disabled={isLoading || showPortal}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : <>Log In <ArrowRight size={20} /></>}
                </button>

            </form>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;