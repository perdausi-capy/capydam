import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/capytech-fav.png';
// --- NEW IMPORTS ---
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  LayoutDashboard, 
  UploadCloud, 
  LogOut, 
  Folder, 
  Users, 
  Menu, 
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';


const Layout = ({ children }: { children: React.ReactNode }) => {
  const { logout, user } = useAuth();
  const location = useLocation();
  
// Mobile Menu State
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
// Desktop Sidebar Collapse State
// CHANGE THIS TO TRUE
const [isCollapsed, setIsCollapsed] = useState(true);

  const handleNavClick = () => setIsMobileMenuOpen(false);

  const navClass = (path: string) =>
    `flex items-center space-x-2 px-4 py-3 rounded-lg transition-colors overflow-hidden ${
      location.pathname.startsWith(path) && path !== '/' 
        ? 'bg-blue-100 text-blue-700 font-medium'
        : location.pathname === '/' && path === '/'
        ? 'bg-blue-100 text-blue-700 font-medium'
        : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="flex min-h-screen bg-gray-50">


      {/* --- ADD CONTAINER HERE --- */}
      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      {/* -------------------------- */}
      
      {/* --- MOBILE HEADER --- */} 
      <div className="fixed top-0 left-0 right-0 z-20 flex h-16 items-center justify-between border-b bg-white px-4 shadow-sm lg:hidden">
        {/* Mobile Logo + Name */}
        
        <div className="flex items-center gap-2">
            <img src={logo} alt="Capydam" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-gray-800">Capydam</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* --- SIDEBAR --- */}
      <aside 
          className={`fixed inset-y-0 left-0 z-30 border-r border-white/40 shadow-glass transition-all duration-300
            ${/* Use the glass utility we made */ 'glass'} 
            ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
            ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
          `}
        >
        {/* HEADER / LOGO AREA */}
        <div className={`flex h-16 items-center border-b px-6 transition-all ${isCollapsed ? 'justify-center px-0' : ''}`}>
           {/* Logic: Always show logo. If Expanded, show text next to it. */}
           <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
               <img src={logo} alt="Capydam" className="h-8 w-8 object-contain" />
               
               {/* Hide text smoothly when collapsed */}
               <span className={`text-xl font-bold text-gray-800 whitespace-nowrap transition-opacity duration-300 ${
                   isCollapsed ? 'opacity-0 w-0 overflow-hidden hidden' : 'opacity-100'
               }`}>
                   Capydam
               </span>
           </div>
        </div>
        
        {/* Navigation Links */}
        <nav className="flex flex-col space-y-1 p-2 mt-2">
          <Link to="/" className={navClass('/')} onClick={handleNavClick} title="Assets">
            <LayoutDashboard size={20} className="shrink-0" />
            {!isCollapsed && <span className="truncate">Assets</span>}
          </Link>
          
          <Link to="/upload" className={navClass('/upload')} onClick={handleNavClick} title="Upload">
            <UploadCloud size={20} className="shrink-0" />
            {!isCollapsed && <span className="truncate">Upload</span>}
          </Link>

          <Link to="/collections" className={navClass('/collections')} onClick={handleNavClick} title="Collections">
             <Folder size={20} className="shrink-0" />
             {!isCollapsed && <span className="truncate">Collections</span>}
          </Link>

          {user?.role === 'admin' && (
            <Link to="/users" className={navClass('/users')} onClick={handleNavClick} title="Users">
              <Users size={20} className="shrink-0" />
              {!isCollapsed && <span className="truncate">Users</span>}
            </Link>
          )}
        </nav>

        {/* Footer Section */}
        <div className="absolute bottom-0 w-full border-t p-2">
          
          {/* Collapse Toggle Button (Desktop Only) */}
          <button 
             onClick={() => setIsCollapsed(!isCollapsed)}
             className="hidden lg:flex w-full items-center justify-center p-2 mb-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
             {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>

          {/* User Info */}
          <div className={`mb-2 px-2 text-sm text-gray-500 transition-all ${isCollapsed ? 'text-center' : ''}`}>
            {!isCollapsed ? (
              <>
                <p className="truncate font-medium">{user?.name || 'User'}</p>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium uppercase text-gray-600">
                  {user?.role}
                </span>
              </>
            ) : (
               <div className="h-8 w-8 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                 {user?.name?.charAt(0) || 'U'}
               </div>
            )}
          </div>
          
          {/* Logout Button */}
          <button
            onClick={logout}
            className={`flex w-full items-center space-x-2 rounded-lg px-4 py-2 text-red-600 hover:bg-red-50 transition-all ${isCollapsed ? 'justify-center px-0' : ''}`}
            title="Logout"
          >
            <LogOut size={20} className="shrink-0" />
            {!isCollapsed && <span className="truncate">Logout</span>}
          </button>
        </div>
      </aside>

      {/* --- OVERLAY (Mobile only) --- */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-10 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <main 
        className={`min-h-screen w-full p-4 pt-20 transition-all duration-300
          ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'}
          lg:p-8
        `}
      >
        {children}
      </main>
    </div>
  );
};

export default Layout;