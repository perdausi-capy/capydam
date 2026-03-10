import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/capytech-fav.png'; 
import { ToastContainer } from 'react-toastify';
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
  ChevronLeft,
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
  Trophy
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

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme(); 
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); 
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeCollapsed = isCollapsed && !isMobile;

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
      
      <div className="fixed top-0 left-0 right-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] px-4 shadow-sm lg:hidden transition-colors duration-300">
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
           <Link to="/" className="flex items-center h-full transition-all duration-300 outline-none" onClick={handleNavClick}>
               {activeCollapsed ? (
                   <img src={logo} alt="Icon" className="h-8 w-8 object-contain transition-transform hover:scale-110" />
               ) : (
                   <BrandTitle isOpen={!activeCollapsed} />
               )}
           </Link>

           {!activeCollapsed && (
             <div className="flex items-center gap-1">
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
             <div className="absolute -right-3 top-16 hidden lg:flex flex-col gap-2 z-50">
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
              <NavItem to="/admin/feedback" icon={<MessageSquare size={20} />} label="Feedback" isCollapsed={activeCollapsed} active={isActive('/admin/feedback')} onClick={handleNavClick} badge={stats?.newFeedback} />
              <NavItem to="/admin/analytics" icon={<TrendingUp size={20} />} label="Analytics" isCollapsed={activeCollapsed} active={isActive('/admin/analytics')} onClick={handleNavClick} />
              <NavItem to="/admin/recycle-bin" icon={<Trash2 size={20} />} label="Bin" isCollapsed={activeCollapsed} active={isActive('/admin/recycle-bin')} onClick={handleNavClick} />
              <NavItem to="/admin/daily-quest" icon={<Sparkles size={20} />} label="Daily Quest" isCollapsed={activeCollapsed} active={isActive('/admin/daily-quest')} onClick={handleNavClick} />
            </>
          )}
        </nav>

        <div className="border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 p-3 mt-auto shrink-0 transition-colors">
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

              <button onClick={handleLogout} className={`text-gray-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg ${activeCollapsed ? 'hidden' : 'ml-1'}`} title="Logout">
                 <LogOut size={18} />
              </button>
          </div>
          
          <div className={`mt-2 flex w-full justify-center gap-2 lg:hidden`}>
            <button onClick={handleLogout} className="flex-1 flex items-center justify-center gap-2 p-2 text-red-500 bg-white dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 font-bold text-sm" title="Logout">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {isMobileMenuOpen && <div className="fixed inset-0 z-30 bg-gray-900/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      <main className={`min-h-screen w-full pt-16 lg:pt-0 transition-all duration-300 ease-in-out dark:text-white ${activeCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        {children}
      </main>
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

export default Layout;