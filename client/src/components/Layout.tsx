import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/capytech-fav.png'; // Small Icon
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import { motion, type Variants } from 'framer-motion'; // ✅ Import Framer Motion
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
  LibraryBig,
  FileArchive
} from 'lucide-react';
import FloatingThemeToggle from './FloatingThemeToggle';

// Define Stats Interface
interface AdminStats {
  pendingUsers: number;
  newFeedback: number;
}

// 💎 ANIMATED BRAND TITLE (Falling Letters Effect)
const BrandTitle = ({ isOpen }: { isOpen: boolean }) => {
  
  // ✅ 2. Explicitly type as Variants
  const containerVars: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { 
        staggerChildren: 0.05, 
        delayChildren: 0.1 
      }
    }
  };

  // ✅ 3. Explicitly type as Variants
  const letterVars: Variants = {
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        damping: 12,
        stiffness: 200,
      }
    },
    hidden: {
      y: -25,
      opacity: 0,
      transition: {
        type: "spring",
        damping: 12,
        stiffness: 200
      }
    }
  };

  return (
    <div className="flex items-center gap-3 select-none overflow-hidden h-10">
      {/* LOGO (Rotates in) */}
      <motion.div
        layout
        transition={{ duration: 0.5, type: 'spring' }}
        className="relative z-20 flex-shrink-0"
      >
        <img src={logo} alt="CapyTech" className="h-8 w-8 object-contain" />
      </motion.div>

      {/* TEXT (Only renders if sidebar is Open) */}
      {isOpen && (
        <motion.div
          className="flex items-center"
          variants={containerVars}
          initial="hidden"
          animate="visible"
        >
          {/* "CAPY" - Dark/White */}
          {"CAPY".split("").map((char, index) => (
            <motion.span 
              key={`c-${index}`} 
              variants={letterVars} 
              className="font-heading text-xl font-extrabold tracking-tight text-gray-900 dark:text-white"
            >
              {char}
            </motion.span>
          ))}
          
          {/* "DAM" - Blue */}
          {"DAM".split("").map((char, index) => (
            <motion.span 
              key={`d-${index}`} 
              variants={letterVars} 
              className="font-heading text-xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400"
            >
              {char}
            </motion.span>
          ))}
        </motion.div>
      )}
    </div>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { logout, user } = useAuth();
  const { theme } = useTheme(); 
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // 1. FETCH ADMIN STATS
  const isAdmin = user?.role === 'admin' || user?.role === 'editor';
  
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await client.get('/admin/stats');
      return data;
    },
    enabled: isAdmin,
    refetchInterval: 30000,
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

      <ToastContainer 
        position="top-right"
        autoClose={3000}
        theme={theme === 'dark' ? 'dark' : 'light'}
      />
      
      <FloatingThemeToggle />
      
      {/* MOBILE HEADER */} 
      <div className="fixed top-0 left-0 right-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] px-4 shadow-sm lg:hidden transition-colors duration-300">
        <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="CapyDAM" className="h-8 w-8" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">CapyDAM</h1>
        </Link>

        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="rounded-lg p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* SIDEBAR */}
      <aside 
          className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] transition-all duration-300 ease-in-out
            ${isMobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full lg:translate-x-0 lg:shadow-none'}
            ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
          `}
        >
        
        {/* LOGO SECTION - HEADER */}
        {/* We use h-[65px] or py-3 to match DashboardHeader height exactly so borders align */}
        <div className="flex h-16 items-center border-b border-gray-200 dark:border-white/5 shrink-0 transition-colors">
           <Link 
             to="/" 
             className={`flex items-center w-full h-full transition-all duration-300 ${isCollapsed ? 'justify-center' : 'px-6'}`}
           >
               {isCollapsed ? (
                   // 1. COLLAPSED: Just the Logo
                   <img 
                     src={logo} 
                     alt="Icon" 
                     className="h-8 w-8 object-contain transition-transform hover:scale-110" 
                   />
               ) : (
                   // 2. EXPANDED: Animated Title ✅
                   <BrandTitle isOpen={!isCollapsed} />
               )}
           </Link>
        </div>
        
        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col space-y-1 p-3 mt-2 overflow-y-auto custom-scrollbar">
          
          {/* Collapse Toggle */}
          <div className={`flex gap-2 mb-6 p-1.5 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 transition-colors ${isCollapsed ? 'flex-col' : 'flex-row'}`}>
             <button onClick={() => setIsCollapsed(!isCollapsed)} className="flex-1 flex items-center justify-center p-2 text-gray-500 dark:text-gray-400 bg-white dark:bg-white/5 hover:text-blue-600 hover:bg-white dark:hover:bg-white/10 dark:hover:text-white rounded-lg transition-all shadow-sm border border-gray-100 dark:border-white/5 hover:border-blue-200" title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
             </button>
          </div>

          <NavItem to="/" icon={<Compass size={20} />} label="Explore" isCollapsed={isCollapsed} active={isActive('/')} onClick={handleNavClick} />
          <NavItem to="/library" icon={<LayoutDashboard size={20} />} label="Library" isCollapsed={isCollapsed} active={isActive('/library')} onClick={handleNavClick} />
          
          {user?.role !== 'viewer' && (
            <NavItem to="/upload" icon={<UploadCloud size={20} />} label="Upload" isCollapsed={isCollapsed} active={isActive('/upload')} onClick={handleNavClick} />
          )}
          
          <NavItem to="/collections" icon={<Folder size={20} />} label="Collections" isCollapsed={isCollapsed} active={isActive('/collections')} onClick={handleNavClick} />
          
          <NavItem 
            to="/chat" 
            icon={<Hash size={20} />} 
            label="Community" 
            isCollapsed={isCollapsed} 
            active={isActive('/chat')} 
            onClick={handleNavClick} 
          />

          <NavItem to="/support" icon={<HelpCircle size={20} />} label="Support" isCollapsed={isCollapsed} active={isActive('/support')} onClick={handleNavClick} />
 <NavItem to="/jrd-assets" icon={<LibraryBig size={20} />} label="JRD Assets" isCollapsed={isCollapsed} active={isActive('/jrd')} onClick={handleNavClick} />
          <NavItem to="/scorm-extractor" icon={<FileArchive size={20} />} label="Scorm Extractor" isCollapsed={isCollapsed} active={isActive('/scorm-extractor')} onClick={handleNavClick} />
         
          {/* Admin Section */}
          {isAdmin && (
            <>
              <div className={`my-4 border-t border-gray-100 dark:border-white/5 ${isCollapsed ? 'mx-2' : 'mx-4'}`}></div>
              
              <NavItem 
                to="/users" 
                icon={<Users size={20} />} 
                label="Users" 
                isCollapsed={isCollapsed} 
                active={isActive('/users')} 
                onClick={handleNavClick}
                badge={stats?.pendingUsers}
              />
              
              <NavItem 
                to="/admin/feedback" 
                icon={<MessageSquare size={20} />} 
                label="Feedback" 
                isCollapsed={isCollapsed} 
                active={isActive('/admin/feedback')} 
                onClick={handleNavClick} 
                badge={stats?.newFeedback}
            />

              <NavItem 
                to="/admin/analytics" 
                icon={<TrendingUp size={20} />} 
                label="Analytics" 
                isCollapsed={isCollapsed} 
                active={isActive('/admin/analytics')} 
                onClick={handleNavClick} 
              />

                <NavItem 
                to="/admin/recycle-bin" 
                icon={<Trash2 size={20} />} 
                label="Bin" 
                isCollapsed={isCollapsed} 
                active={isActive('/admin/recycle-bin')} 
                onClick={handleNavClick} 
              />
            </>
          )}
        </nav>

        {/* PROFILE SECTION */}
        <div className="border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 p-3 mt-auto shrink-0 transition-colors">
          <div className={`flex items-center rounded-xl border border-transparent transition-all duration-200 ${!isCollapsed ? 'bg-white dark:bg-white/5 shadow-sm border-gray-100 dark:border-white/5 p-2' : 'justify-center p-0'}`}>
              
              <Link 
                to="/profile" 
                className={`flex items-center flex-1 min-w-0 group ${isCollapsed ? 'justify-center' : ''}`}
                title="View Profile"
              >
                  <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm overflow-hidden ring-2 ring-transparent group-hover:ring-blue-400 transition-all relative">
                      {user?.avatar ? (
                          <img 
                            src={user.avatar} 
                            alt={user.name} 
                            className="h-full w-full object-cover" 
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'; 
                              e.currentTarget.parentElement?.classList.remove('bg-transparent'); 
                            }}
                          />
                      ) : (
                          <span className="uppercase">{user?.name?.charAt(0) || 'U'}</span>
                      )}
                  </div>
                  
                  <div className={`flex flex-col ml-3 overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100'}`}>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{user?.name || 'User'}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate group-hover:text-blue-500 transition-colors">View Profile</p>
                  </div>
              </Link>

              <button 
                onClick={handleLogout} 
                className={`text-gray-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg ${isCollapsed ? 'hidden' : 'ml-1'}`} 
                title="Logout"
              >
                 <LogOut size={18} />
              </button>
          </div>
          
          <button onClick={handleLogout} className={`mt-2 flex w-full justify-center p-2 text-red-500 lg:hidden`}><LogOut size={20} /></button>
        </div>
      </aside>

      {isMobileMenuOpen && <div className="fixed inset-0 z-10 bg-gray-900/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      <main className={`min-h-screen w-full pt-20 lg:pt-0 transition-all duration-300 ease-in-out dark:text-white ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        {children}
      </main>
    </div>
  );
};

// NavItem Helper
const NavItem = ({ to, icon, label, isCollapsed, active, onClick, badge }: any) => {
  return (
    <Link 
      to={to} 
      onClick={onClick} 
      title={isCollapsed ? label : ''} 
      className={`
        group relative flex items-center rounded-lg px-3 py-2.5 transition-all duration-200 
        ${active 
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
        } 
        ${isCollapsed ? 'justify-center' : ''}
      `}
    >
      {active && <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-blue-600 dark:bg-blue-500" />}
      
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

export default Layout;