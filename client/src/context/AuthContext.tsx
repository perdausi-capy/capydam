import React, { createContext, useContext, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion'; 
import { LogOut, Loader2 } from 'lucide-react';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  streak?: number; // ✅ ADDED: Gamification Field
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Hydrate user state on refresh
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        setIsLoggingOut(false);
        window.location.href = '/login';
    }, 1200);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}

      <AnimatePresence>
        {isLoggingOut && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-[#0B0D0F] backdrop-blur-xl"
            >
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="flex flex-col items-center gap-6"
                >
                    <div className="relative">
                        <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full animate-pulse" />
                        <div className="relative bg-white dark:bg-black/40 p-6 rounded-full shadow-2xl border border-red-100 dark:border-red-900/30">
                            <LogOut size={48} className="text-red-500" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Signing Out...
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400">
                            See you soon{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
                        </p>
                    </div>
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                        <Loader2 className="text-gray-400" size={24} />
                    </motion.div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};