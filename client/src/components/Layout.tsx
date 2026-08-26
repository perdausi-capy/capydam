import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/capytech-fav.png';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import { motion, type Variants } from 'framer-motion';
import {
  LayoutDashboard,
  UploadCloud,
  LogOut,
  Folder,
  Users,
  Menu,
  X,
  ChevronRight,
  Compass,
  HelpCircle,
  MessageSquare,
  TrendingUp,
  Trash2,
  Hash,
  Box,
  Sparkles,
  Sun,
  Moon,
  PanelLeftClose,
  Trophy,
  Monitor,
  Server,
  FileText,
  CheckCircle,
  Lock,
  ArrowDown,
  ShieldCheck
} from 'lucide-react';
import FloatingClickUp from './FloatingClickUp';

interface AdminStats {
  pendingUsers: number;
  newFeedback: number;
}

const BrandTitle = ({ isOpen }: { isOpen: boolean }) => {
  const containerVars: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
  };

  const letterVars: Variants = {
    visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 12, stiffness: 200 } },
    hidden: { y: -25, opacity: 0, transition: { type: "spring", damping: 12, stiffness: 200 } }
  };

  return (
    <div className="flex items-center gap-2 select-none overflow-hidden h-10">
      <motion.div layout transition={{ duration: 0.5, type: 'spring' }} className="relative z-20 flex-shrink-0">
        <img src={logo} alt="CapyTech" className="h-7 w-7 object-contain" />
      </motion.div>

      {isOpen && (
        <motion.div className="flex items-center" variants={containerVars} initial="hidden" animate="visible">
          {"CAPY".split("").map((char, index) => (
            <motion.span key={`c-${index}`} variants={letterVars} className="font-heading text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">
              {char}
            </motion.span>
          ))}
          {"DAM".split("").map((char, index) => (
            <motion.span key={`d-${index}`} variants={letterVars} className="font-heading text-lg font-extrabold tracking-tight text-blue-600 dark:text-blue-400">
              {char}
            </motion.span>
          ))}
        </motion.div>
      )}
    </div>
  );
};

const NavSectionHeader = ({ label, isCollapsed }: { label: string, isCollapsed: boolean }) => {
  if (isCollapsed) return <div className="my-2 border-t border-gray-200 dark:border-white/10 mx-3" />;

  return (
    <div className="px-4 text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mt-5 mb-1.5 flex items-center gap-2">
      {label}
    </div>
  );
};


// ─── PC SOP Side Panel ───────────────────────────────────────────────────────
interface PCSopModalProps {
  onClose: () => void;
  sidebarCollapsed: boolean;
  onAccept: () => void;
  isAccepted: boolean;
  onLogout: () => void;
}

const PCSopModal = ({ onClose, sidebarCollapsed, onAccept, isAccepted, onLogout }: PCSopModalProps) => {
  const sidebarW = sidebarCollapsed ? 80 : 256;
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(isAccepted);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data: sopUpdateDate } = useQuery({
    queryKey: ['sop-update-date'],
    queryFn: async () => {
      const { data } = await client.get('/users/sop-update-date');
      return data.date;
    }
  });

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (hasScrolledToBottom) return;
    const target = e.currentTarget;
    const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 40;
    if (isAtBottom) {
      setHasScrolledToBottom(true);
    }
  };

  return (
    <>
      <style>{`
        @keyframes pc-sop-slide-in {
          from { transform: translateX(-20px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
        @keyframes pc-sop-rainbow-bar {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .pc-sop-panel {
          animation: pc-sop-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .pc-sop-rainbow-bar {
          height: 3px;
          background: linear-gradient(90deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000);
          background-size: 300% 300%;
          animation: pc-sop-rainbow-bar 4s linear infinite;
          flex-shrink: 0;
        }
      `}</style>

      {/* Glass backdrop scrim */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 44,
        left: sidebarW,
        backdropFilter: 'blur(12px) saturate(160%)',
        WebkitBackdropFilter: 'blur(12px) saturate(160%)',
        background: 'rgba(10, 12, 20, 0.65)',
      }} onClick={onClose} />

      {/* Panel */}
      <div
        className="pc-sop-panel"
        style={{
          position: 'fixed',
          top: '4%',
          bottom: '4%',
          left: sidebarW + 32,
          right: 32,
          zIndex: 45,
          background: 'rgba(20, 24, 35, 0.92)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '20px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Animated rainbow top bar */}
        <div className="pc-sop-rainbow-bar" />

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            }}>
              <FileText size={18} style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px', letterSpacing: '0.04em' }}>WORKSTATION SOP</span>
                {isAccepted ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck size={12} /> Accepted
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                    <Lock size={12} /> Pending Acceptance
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
                <span>Standard Operating Procedure & Safety Compliance</span>
                {sopUpdateDate && (
                  <>
                    <span>•</span>
                    <span className="text-blue-400">Last Updated: {new Date(sopUpdateDate).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
              borderRadius: '9px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.2)';
              (e.currentTarget as HTMLButtonElement).style.color = '#ef4444';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.3)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Container containing Document & Guidelines */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
          className="custom-scrollbar"
        >
          {!isAccepted && (
            <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-3.5 flex items-center gap-3 text-blue-200 text-xs shrink-0">
              <ShieldCheck className="text-blue-400 shrink-0" size={20} />
              <div>
                <p className="font-semibold text-blue-100">Workstation Compliance Notice</p>
                <p className="text-blue-300/80">Please review the Workstation SOP document below. You must scroll to the bottom of this container to enable the acceptance button and unlock system navigation.</p>
              </div>
            </div>
          )}

          {/* Embedded Google Document Frame */}
          <div style={{
            height: '520px',
            minHeight: '420px',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
            background: '#ffffff',
            flexShrink: 0,
          }}>
            <iframe
              src="https://drive.google.com/file/d/19Q0_Jmen7-8tlgUGEUJWsm18GejBXCtx/preview"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title="Workstation SOP"
              allow="fullscreen"
            />
          </div>

          {/* Guidelines Summary & Agreement Declaration */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-gray-300 text-sm space-y-3 shrink-0">
            <h4 className="text-white font-bold text-base flex items-center gap-2">
              <ShieldCheck size={18} className="text-blue-400" /> Key Standard Operating Principles
            </h4>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-300/90 leading-relaxed">
              <li>Adhere to workstation clean desk and security compliance protocols at all times.</li>
              <li>Ensure all assets and confidential data accessed within CAPYDAM are properly authorized.</li>
              <li>Report hardware or network anomalies immediately to system administrators.</li>
              <li>Log off or lock your station when leaving the workstation unattended.</li>
            </ul>
            <div className="pt-2 border-t border-white/10 text-xs text-gray-400 italic">
              By clicking "I Accept the Workstation SOP", you confirm that you have read, understood, and agreed to adhere to these operating procedures.
            </div>
          </div>
        </div>

        {/* Footer Acceptance Bar */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(15, 18, 28, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexShrink: 0,
        }}>
          {!hasScrolledToBottom && !isAccepted ? (
            <div className="flex items-center gap-2 text-amber-400 text-xs font-medium animate-pulse">
              <ArrowDown size={16} />
              <span>Scroll to the bottom of the container to enable acceptance button</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
              <CheckCircle size={16} />
              <span>Document review complete</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            {!isAccepted ? (
              <>
                <button
                  onClick={onLogout}
                  className="px-4 py-2.5 rounded-xl font-medium text-xs text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 transition-all flex items-center gap-2"
                  title="Decline agreement and log out"
                >
                  <LogOut size={16} />
                  Decline & Logout
                </button>
                <button
                  disabled={!hasScrolledToBottom}
                  onClick={onAccept}
                  className={`
                    px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all duration-300 shadow-lg
                    ${hasScrolledToBottom
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-900/40 cursor-pointer scale-100'
                      : 'bg-gray-800 text-gray-500 border border-gray-700/50 cursor-not-allowed opacity-60'
                    }
                  `}
                >
                  <CheckCircle size={18} />
                  I Accept the Workstation SOP
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg flex items-center gap-2"
              >
                <CheckCircle size={18} />
                Accepted (Close Window)
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { logout, login, user, token } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Use backend state for SOP acceptance
  const isSopAccepted = user ? !!user.sopAccepted : true; // default to true if no user so it doesn't flash

  const [isPCSopOpen, setIsPCSopOpen] = useState<boolean>(false);

  useEffect(() => {
    if (user && !user.sopAccepted) {
      setIsPCSopOpen(true);
    } else {
      setIsPCSopOpen(false);
    }
  }, [user]);

  const handleAcceptSop = async () => {
    try {
      await client.patch('/users/profile/sop');
      if (user && token) {
        login(token, { ...user, sopAccepted: true });
      }
      setIsPCSopOpen(false);
    } catch (err) {
      toast.error('Failed to accept SOP');
    }
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeCollapsed = isCollapsed && !isMobile;
  const isDimmed = !isSopAccepted;

  const isAdmin = user?.role === 'admin';

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await client.get('/admin/stats');
      return data;
    },
    enabled: isAdmin,
    staleTime: 1000 * 60 * 1
  });

  const handleNavClick = () => setIsMobileMenuOpen(false);

  const handleLogout = () => {
    queryClient.removeQueries();
    queryClient.clear();
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="flex min-h-screen bg-[#F3F4F6] dark:bg-[#0B0D0F] transition-colors duration-500 ease-in-out">

      <ToastContainer position="top-right" autoClose={3000} theme={theme === 'dark' ? 'dark' : 'light'} />
      <FloatingClickUp />

      <div className={`fixed top-0 left-0 right-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] px-4 shadow-sm lg:hidden transition-all duration-300 ${isDimmed ? 'opacity-40 pointer-events-none' : ''}`}>
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="CapyDAM" className="h-8 w-8" />
          <h1 className="text-xl font-extrabold tracking-tight font-heading">
            <span className="text-gray-900 dark:text-white">CAPY</span>
            <span className="text-blue-600 dark:text-blue-400">DAM</span>
          </h1>
        </Link>

        <div className="flex items-center gap-2">
          <button onClick={(e) => toggleTheme(e)} className="p-2 text-gray-400 hover:text-yellow-500 dark:hover:text-blue-400">
            {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="rounded-lg p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] transition-all duration-300 ease-in-out
            ${isMobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full lg:translate-x-0 lg:shadow-none'}
            ${activeCollapsed ? 'lg:w-20' : 'lg:w-64'}
          `}
      >

        <div className={`relative flex h-16 items-center border-b border-gray-200 dark:border-white/5 shrink-0 transition-all duration-300 ${activeCollapsed ? 'justify-center px-0' : 'justify-between pl-5 pr-3'}`}>
          <Link to="/" className={`flex items-center h-full transition-all duration-300 outline-none ${isDimmed ? 'opacity-40 pointer-events-none' : ''}`} onClick={handleNavClick}>
            {activeCollapsed ? (
              <img src={logo} alt="Icon" className="h-8 w-8 object-contain transition-transform hover:scale-110" />
            ) : (
              <BrandTitle isOpen={!activeCollapsed} />
            )}
          </Link>

          {!activeCollapsed && (
            <div className={`flex items-center gap-1 ${isDimmed ? 'opacity-40 pointer-events-none' : ''}`}>
              <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                <X size={20} />
              </button>
              <button onClick={(e) => toggleTheme(e)} className="hidden lg:block p-1.5 text-gray-400 hover:text-yellow-500 dark:hover:text-blue-400 transition-colors hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg" title="Toggle Theme">
                {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <button onClick={() => setIsCollapsed(true)} className="hidden lg:flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors" title="Collapse Sidebar">
                <PanelLeftClose size={18} />
              </button>
            </div>
          )}

          {activeCollapsed && (
            <div className={`absolute -right-3 top-16 hidden lg:flex flex-col gap-2 z-50 ${isDimmed ? 'opacity-40 pointer-events-none' : ''}`}>
              <button onClick={() => setIsCollapsed(false)} className="flex items-center justify-center p-1.5 bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 shadow-sm text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors" title="Expand Sidebar">
                <ChevronRight size={14} />
              </button>
              <button onClick={(e) => toggleTheme(e)} className="flex items-center justify-center p-1.5 bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 shadow-sm text-gray-400 hover:text-yellow-500 dark:hover:text-blue-400 rounded-lg transition-colors" title="Toggle Theme">
                {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 flex flex-col px-3 py-2 overflow-y-auto custom-scrollbar">
          <div className={`flex flex-col transition-all duration-300 ${isDimmed ? 'opacity-30 pointer-events-none select-none' : ''}`}>
            <NavSectionHeader label="Main Menu" isCollapsed={activeCollapsed} />
            <NavItem to="/" icon={<Compass size={20} />} label="Explore" isCollapsed={activeCollapsed} active={isActive('/')} onClick={handleNavClick} />
            <NavItem to="/library" icon={<LayoutDashboard size={20} />} label="Library" isCollapsed={activeCollapsed} active={isActive('/library')} onClick={handleNavClick} />

            {user?.role !== 'viewer' && (
              <NavItem to="/upload" icon={<UploadCloud size={20} />} label="Upload" isCollapsed={activeCollapsed} active={isActive('/upload')} onClick={handleNavClick} />
            )}

            <NavItem to="/collections" icon={<Folder size={20} />} label="Collections" isCollapsed={activeCollapsed} active={isActive('/collections')} onClick={handleNavClick} />

            <NavSectionHeader label="Workspace" isCollapsed={activeCollapsed} />

            {/* ✅ HOMING BEACON ADDED HERE (targetId="leaderboard-target-icon") */}
            <NavButton
              id="leaderboard-nav-btn"
              targetId="leaderboard-target-icon"
              icon={<Trophy size={20} className="text-yellow-500" />}
              label="Leaderboard"
              isCollapsed={activeCollapsed}
              onClick={() => {
                handleNavClick();
                window.dispatchEvent(new Event('open_leaderboard'));
              }}
            />

            <NavItem to="/chat" icon={<Hash size={20} />} label="Community" isCollapsed={activeCollapsed} active={isActive('/chat')} onClick={handleNavClick} />
            <NavItem to="/apps" icon={<Box size={20} />} label="Apps" isCollapsed={activeCollapsed} active={isActive('/apps') || isActive('/scorm-extractor') || isActive('/jrd-assets')} onClick={handleNavClick} />
            <NavItem to="/support" icon={<HelpCircle size={20} />} label="Support" isCollapsed={activeCollapsed} active={isActive('/support')} onClick={handleNavClick} />

            {isAdmin && (
              <>
                <NavSectionHeader label="Administration" isCollapsed={activeCollapsed} />
                <NavItem to="/users" icon={<Users size={20} />} label="Users" isCollapsed={activeCollapsed} active={isActive('/users')} onClick={handleNavClick} badge={stats?.pendingUsers} />
                <NavItem to="/admin/daily-quest" icon={<Sparkles size={20} />} label="Daily Quest" isCollapsed={activeCollapsed} active={isActive('/admin/daily-quest')} onClick={handleNavClick} />
                <NavItem to="/admin/feedback" icon={<MessageSquare size={20} />} label="Feedback" isCollapsed={activeCollapsed} active={isActive('/admin/feedback')} onClick={handleNavClick} badge={stats?.newFeedback} />
                <NavItem to="/admin/itt" icon={<Monitor size={20} />} label="ITT Inventory" isCollapsed={activeCollapsed} active={isActive('/admin/itt')} onClick={handleNavClick} />
                <NavItem to="/admin/infrastructure" icon={<Server size={20} />} label="Servers" isCollapsed={activeCollapsed} active={isActive('/admin/infrastructure')} onClick={handleNavClick} />
                <NavItem to="/admin/analytics" icon={<TrendingUp size={20} />} label="Analytics" isCollapsed={activeCollapsed} active={isActive('/admin/analytics')} onClick={handleNavClick} />
                <NavItem to="/admin/recycle-bin" icon={<Trash2 size={20} />} label="Bin" isCollapsed={activeCollapsed} active={isActive('/admin/recycle-bin')} onClick={handleNavClick} />
              </>
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-white/5">
            <PCSopNavButton
              isCollapsed={activeCollapsed}
              isAccepted={isSopAccepted}
              onClick={() => { handleNavClick(); setIsPCSopOpen(true); }}
            />
          </div>
        </nav>

        <div className={`border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 p-3 mt-auto shrink-0 transition-all duration-300 ${isDimmed ? 'opacity-30 pointer-events-none select-none' : ''}`}>
          <div className={`flex items-center rounded-xl border border-transparent transition-all duration-200 ${!activeCollapsed ? 'bg-white dark:bg-white/5 shadow-sm border-gray-100 dark:border-white/5 p-2' : 'justify-center p-0'}`}>

            <Link to="/profile" onClick={handleNavClick} className={`flex items-center flex-1 min-w-0 group ${activeCollapsed ? 'justify-center' : ''}`} title="View Profile">
              <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm overflow-hidden ring-2 ring-transparent group-hover:ring-blue-400 transition-all relative">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.remove('bg-transparent'); }} />
                ) : (
                  <span className="uppercase">{user?.name?.charAt(0) || 'U'}</span>
                )}
              </div>

              <div className={`flex flex-col ml-3 overflow-hidden transition-all duration-300 ${activeCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100'}`}>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{user?.name || 'User'}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate group-hover:text-blue-500 transition-colors">View Profile</p>
              </div>
            </Link>

            {isSopAccepted && (
              <button onClick={handleLogout} className={`text-gray-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg ${activeCollapsed ? 'hidden' : 'ml-1'}`} title="Logout">
                <LogOut size={18} />
              </button>
            )}
          </div>

          {!isSopAccepted ? null : (
            <div className={`mt-2 flex w-full justify-center gap-2 lg:hidden`}>
              <button onClick={handleLogout} className="flex-1 flex items-center justify-center gap-2 p-2 text-red-500 bg-white dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 font-bold text-sm" title="Logout">
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {isMobileMenuOpen && <div className="fixed inset-0 z-30 bg-gray-900/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      <main className={`min-h-screen w-full pt-16 lg:pt-0 transition-all duration-300 ease-in-out dark:text-white ${activeCollapsed ? 'lg:ml-20' : 'lg:ml-64'} ${isDimmed ? 'opacity-30 pointer-events-none select-none blur-[0.5px]' : ''}`}>
        {children}
      </main>

      {isPCSopOpen && (
        <PCSopModal
          onClose={() => setIsPCSopOpen(false)}
          sidebarCollapsed={activeCollapsed}
          onAccept={handleAcceptSop}
          isAccepted={isSopAccepted}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
};

const NavItem = ({ to, icon, label, isCollapsed, active, onClick, badge }: any) => {
  return (
    <Link
      to={to}
      onClick={onClick}
      title={isCollapsed ? label : ''}
      className={`
        group relative flex items-center rounded-xl px-3 py-2 mb-1 transition-all duration-200 
        ${active
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
        } 
        ${isCollapsed ? 'justify-center' : ''}
      `}
    >
      {active && <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-blue-600 dark:bg-blue-500" />}

      <div className="relative shrink-0 flex items-center justify-center">
        <span className={`transition-colors ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white'}`}>
          {icon}
        </span>
        {isCollapsed && badge > 0 && (
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-[#1A1D21]" />
        )}
      </div>

      {!isCollapsed && (
        <div className="flex flex-1 items-center justify-between ml-3 overflow-hidden">
          <span className="truncate font-medium text-sm">{label}</span>
          {badge > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 px-1.5 text-[10px] font-bold text-red-600 dark:text-red-400">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
      )}
    </Link>
  );
};

// ✅ MODIFIED: Accepts targetId so we can track the exact icon location
const NavButton = ({ id, targetId, icon, label, isCollapsed, onClick }: any) => {
  return (
    <button
      id={id}
      onClick={onClick}
      title={isCollapsed ? label : ''}
      className={`
        w-full group relative flex items-center rounded-xl px-3 py-2 mb-1 transition-all duration-300 
        text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white
        ${isCollapsed ? 'justify-center' : 'text-left'}
      `}
    >
      {/* Target ID is placed exactly on the icon container */}
      <div id={targetId} className="relative shrink-0 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white transition-colors">
        {icon}
      </div>
      {!isCollapsed && (
        <div className="flex flex-1 items-center justify-between ml-3 overflow-hidden">
          <span className="truncate font-medium text-sm">{label}</span>
        </div>
      )}
    </button>
  );
};

// ─── PC SOP Glow Button ───────────────────────────────────────────────────────
const PCSopNavButton = ({ isCollapsed, onClick, isAccepted }: { isCollapsed: boolean; onClick: () => void; isAccepted: boolean }) => {
  return (
    <>
      <style>{`
        @keyframes pc-sop-glowing {
          0%   { background-position: 0 0; }
          50%  { background-position: 400% 0; }
          100% { background-position: 0 0; }
        }
        @keyframes pc-sop-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .pc-sop-btn {
          width: 100%;
          height: 40px;
          border: none;
          outline: none;
          color: #fff;
          background: #111;
          cursor: pointer;
          position: relative;
          z-index: 10;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.02em;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          margin-bottom: 4px;
          transition: transform 0.2s;
        }
        .pc-sop-btn.unaccepted:before {
          content: '';
          background: linear-gradient(45deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000);
          position: absolute;
          top: -2px;
          left: -2px;
          background-size: 400%;
          z-index: -1;
          filter: blur(5px);
          width: calc(100% + 4px);
          height: calc(100% + 4px);
          animation: pc-sop-glowing 20s linear infinite;
          opacity: 1;
          transition: opacity 0.3s ease-in-out;
          border-radius: 10px;
        }
        .pc-sop-btn:after {
          z-index: -1;
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          background: #111;
          left: 0;
          top: 0;
          border-radius: 10px;
        }
        .pc-sop-btn:active { color: #000; }
        .pc-sop-btn:active:after { background: transparent; }
        .pc-sop-btn-icon { flex-shrink: 0; }
        .pc-sop-btn-collapsed {
          justify-content: center;
          padding: 0;
          width: 40px;
          height: 40px;
          border-radius: 10px;
        }
        .pc-sop-attention {
          animation: pc-sop-pulse-ring 2s infinite;
        }
      `}</style>
      <button
        className={`pc-sop-btn ${isCollapsed ? 'pc-sop-btn-collapsed' : ''} ${!isAccepted ? 'unaccepted pc-sop-attention scale-[1.02]' : ''}`}
        onClick={onClick}
        title={isCollapsed ? 'WORKSTATION SOP' : ''}
      >
        <FileText size={18} className="pc-sop-btn-icon text-blue-400" />
        {!isCollapsed && (
          <div className="flex items-center justify-between flex-1 min-w-0">
            <span className="truncate">WORKSTATION SOP</span>
            {!isAccepted && (
              <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-red-500 text-white animate-pulse">
                REQUIRED
              </span>
            )}
          </div>
        )}
      </button>
    </>
  );
};

export default Layout;