import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/capytech-fav.png';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQueryClient } from '@tanstack/react-query';
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
  Compass
} from 'lucide-react';
import FloatingThemeToggle from './FloatingThemeToggle';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { logout, user } = useAuth();
  const { theme } = useTheme(); 
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

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
      <div className="fixed top-0 left-0 right-0 z-20 flex h-16 items-center justify-between border-b bg-white dark:bg-[#1A1D21] dark:border-white/10 px-4 shadow-sm lg:hidden transition-colors duration-300">
        <div className="flex items-center gap-2">
            <img src={logo} alt="Capydam" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">Capydam</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="rounded-lg p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* SIDEBAR */}
      <aside 
          className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1D21] transition-all duration-300 ease-in-out
            ${isMobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full lg:translate-x-0 lg:shadow-none'}
            ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
          `}
        >
        
        {/* Logo Section */}
        <div className="flex h-16 items-center px-4 border-b border-gray-100 dark:border-white/5 shrink-0 transition-colors">
           <div className={`flex items-center w-full ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
               <img src={logo} alt="Capydam" className="h-8 w-8 object-contain shrink-0" />
               <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                   <span className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">Capydam</span>
               </div>
           </div>
        </div>
        
        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col space-y-1 p-3 mt-2 overflow-y-auto custom-scrollbar">
          
          <div className={`flex gap-2 mb-6 p-1.5 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 transition-colors ${isCollapsed ? 'flex-col' : 'flex-row'}`}>
             <button onClick={() => setIsCollapsed(!isCollapsed)} className="flex-1 flex items-center justify-center p-2 text-gray-500 dark:text-gray-400 bg-white dark:bg-white/5 hover:text-blue-600 hover:bg-white dark:hover:bg-white/10 dark:hover:text-white rounded-lg transition-all shadow-sm border border-gray-100 dark:border-white/5 hover:border-blue-200" title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
             </button>
          </div>

          <NavItem to="/" icon={<Compass size={20} />} label="Explore" isCollapsed={isCollapsed} active={isActive('/')} onClick={handleNavClick} />
          <NavItem to="/library" icon={<LayoutDashboard size={20} />} label="Library" isCollapsed={isCollapsed} active={isActive('/library')} onClick={handleNavClick} />
          {user?.role !== 'viewer' && <NavItem to="/upload" icon={<UploadCloud size={20} />} label="Upload" isCollapsed={isCollapsed} active={isActive('/upload')} onClick={handleNavClick} />}
          <NavItem to="/collections" icon={<Folder size={20} />} label="Collections" isCollapsed={isCollapsed} active={isActive('/collections')} onClick={handleNavClick} />
          {user?.role === 'admin' && (
            <>
              <div className={`my-4 border-t border-gray-100 dark:border-white/5 ${isCollapsed ? 'mx-2' : 'mx-4'}`}></div>
              <NavItem to="/users" icon={<Users size={20} />} label="Users" isCollapsed={isCollapsed} active={isActive('/users')} onClick={handleNavClick} />
            </>
          )}
        </nav>

        {/* ✅ UPDATED PROFILE SECTION */}
        <div className="border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 p-3 mt-auto shrink-0 transition-colors">
          <div className={`flex items-center rounded-xl border border-transparent transition-all duration-200 ${!isCollapsed ? 'bg-white dark:bg-white/5 shadow-sm border-gray-100 dark:border-white/5 p-2' : 'justify-center p-0'}`}>
             
             {/* Profile Link */}
             <Link 
                to="/profile" 
                className={`flex items-center flex-1 min-w-0 group ${isCollapsed ? 'justify-center' : ''}`}
                title="View Profile"
             >
                 <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm overflow-hidden ring-2 ring-transparent group-hover:ring-blue-400 transition-all">
                    {/* Check for Avatar URL */}
                    {user?.avatar ? (
                        <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                    ) : (
                        user?.name?.charAt(0) || 'U'
                    )}
                 </div>
                 
                 <div className={`flex flex-col ml-3 overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100'}`}>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{user?.name || 'User'}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate group-hover:text-blue-500 transition-colors">View Profile</p>
                 </div>
             </Link>

             {/* Logout Button (Desktop) */}
             <button 
                onClick={handleLogout} 
                className={`text-gray-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg ${isCollapsed ? 'hidden' : 'ml-1'}`} 
                title="Logout"
             >
                <LogOut size={18} />
             </button>
          </div>
          
          {/* Logout Button (Mobile) */}
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

const NavItem = ({ to, icon, label, isCollapsed, active, onClick }: any) => {
  return (
    <Link to={to} onClick={onClick} title={isCollapsed ? label : ''} className={`group relative flex items-center rounded-lg px-3 py-2.5 transition-all duration-200 ${active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'} ${isCollapsed ? 'justify-center' : ''}`}>
      {active && <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-blue-600 dark:bg-blue-500" />}
      <span className={`shrink-0 transition-colors ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white'}`}>{icon}</span>
      {!isCollapsed && <span className="ml-3 truncate font-medium text-sm">{label}</span>}
    </Link>
  );
};

export default Layout;