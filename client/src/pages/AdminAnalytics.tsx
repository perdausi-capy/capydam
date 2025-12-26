import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { 
  HardDrive, Users, FileVideo, FileImage, Activity, 
  Terminal, Globe, Lock, Wifi, X, ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
// ✅ Import the Context Hook
import { useTerminal } from '../context/TerminalContext';

// --- TYPES ---
interface AnalyticsData {
  storage: { totalBytes: number; totalAssets: number };
  users: { total: number; admins: number; editors: number; viewers: number };
  breakdown: { images: number; videos: number; audio: number; docs: number; others: number };
  recentActivity: Array<{ id: string; originalName: string; size: number; createdAt: string; uploadedBy: { name: string } }>;
  recentUsers: Array<{ id: string; name: string; role: string; email: string; updatedAt: string }>;
}

interface CyberCardProps {
    label: string;
    value: string | number;
    icon: React.ReactElement;
    sub: string;
    color?: string;
    onClick?: () => void;
}

interface CyberBarProps {
    label: string;
    count: number;
    total: number;
    color?: string;
}

// --- HELPER: FORMAT BYTES ---
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const AdminAnalytics = () => {
  const navigate = useNavigate();
  // ✅ Access the Global Terminal Context
  const { registerCommand, unregisterCommand, addLog } = useTerminal();

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const res = await client.get('/analytics');
      return res.data;
    },
    refetchInterval: 10000 
  });

  // --- MODULE VISIBILITY STATE ---
  const [modules, setModules] = useState({
    stats: false,     
    storage: false,   
    users: false,     
    activity: false,  
  });

  // Helper to toggle modules
  const toggleModule = (key: keyof typeof modules, state: boolean) => {
    setModules(prev => ({ ...prev, [key]: state }));
  };

  // ✅ REGISTER PAGE COMMANDS ON MOUNT
  useEffect(() => {
    // 1. Define 'ls' command handler
    const handleLs = (args: string[]) => {
        const target = args[0];
        if (target === 'users' || target === 'access') {
            toggleModule('users', true);
            addLog('> FETCHING PERSONNEL RECORDS... [DONE]');
        } else if (target === 'storage') {
            toggleModule('storage', true);
            addLog('> MOUNTING STORAGE DRIVES... [MOUNTED]');
        } else if (target === 'activity' || target === 'logs') {
            toggleModule('activity', true);
            addLog('> OPENING LOG STREAM... [OPEN]');
        } else {
            addLog('> ERROR: TARGET NOT FOUND. TRY "users", "storage", "activity"');
        }
    };

    // 2. Define 'init' command handler
    const handleInit = () => {
        setModules({ stats: true, storage: true, users: true, activity: true });
        addLog('> EXECUTING BOOT SEQUENCE... ALL SYSTEMS GO.');
    };

    // 3. Define 'sys_status' handler
    const handleSysStatus = () => {
        toggleModule('stats', true);
        addLog('> ANALYZING SYSTEM METRICS... [OK]');
    };

    // Register them
    registerCommand('ls', handleLs);
    registerCommand('init', handleInit);
    registerCommand('sys_status', handleSysStatus);

    // ✅ CLEANUP: Unregister when leaving page so they don't pollute other pages
    return () => {
        unregisterCommand('ls');
        unregisterCommand('init');
        unregisterCommand('sys_status');
    };
  }, [registerCommand, unregisterCommand, addLog]);

  if (isLoading || !data) return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center font-mono text-gray-800 dark:text-green-500">
       <p className="animate-pulse">&gt; ESTABLISHING UPLINK...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-800 dark:text-green-500 font-mono p-4 lg:p-8 relative overflow-hidden transition-colors duration-500">
      
      {/* --- CRT SCANLINES (Dark Mode Only) --- */}
      <div className="hidden dark:block absolute inset-0 z-50 pointer-events-none" 
           style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }} />
      
      {/* --- BACKGROUND GRID --- */}
      <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
      />

      {/* --- HEADER --- */}
      <div className="relative z-10 flex justify-between items-start border-b border-gray-300 dark:border-green-900/50 pb-2 mb-6 transition-colors">
        <div className="flex items-center gap-2">
           <Terminal size={18} className="text-gray-600 dark:text-green-500" />
           <h1 className="text-lg font-bold tracking-widest uppercase text-gray-900 dark:text-green-500">ROOT_ACCESS // ANALYTICS_SHELL</h1>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-green-400">
           <div className="flex items-center gap-1.5"><Wifi size={12} className="animate-pulse" /> NET_ONLINE</div>
           <div className="flex items-center gap-1.5"><Lock size={12} /> ENCRYPTED</div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 h-full pb-[35vh]">

        {/* 1. TOP STATS CARDS (sys_status) */}
        <AnimatePresence>
          {modules.stats && (
            <motion.div 
               initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
               className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4 mb-4"
            >
               <CyberCard 
                    label="STORAGE" 
                    value={formatBytes(data.storage.totalBytes)} 
                    icon={<HardDrive />} 
                    sub={data.storage.totalAssets + " ITEMS"}
                    onClick={() => navigate('/library')} 
               />
               <CyberCard 
                    label="USERS" 
                    value={data.users.total} 
                    icon={<Users />} 
                    sub={data.users.admins + " ADMINS"}
                    onClick={() => navigate('/users')}
               />
               <CyberCard 
                    label="IMAGES" 
                    value={data.breakdown.images} 
                    icon={<FileImage />} 
                    sub="MAIN ASSETS" 
                    color="text-blue-600 dark:text-cyan-500" 
               />
               <CyberCard 
                    label="VIDEO_LOAD" 
                    value={data.breakdown.videos} 
                    icon={<FileVideo />} 
                    sub="HEAVY MEDIA" 
                    color="text-red-600 dark:text-red-500" 
               />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. ACTIVITY LOG (ls activity) */}
        <AnimatePresence>
          {modules.activity && (
             <motion.div 
                initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                className="lg:col-span-8 border border-gray-300 dark:border-green-900 bg-white dark:bg-black/40 p-4 h-[400px] flex flex-col shadow-sm dark:shadow-none"
             >
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-green-900 pb-2 mb-2">
                   <h3 className="text-sm font-bold uppercase flex items-center gap-2 text-gray-700 dark:text-green-400"><Activity size={14}/> UPLOAD_STREAM</h3>
                   <button onClick={() => toggleModule('activity', false)}><X size={14} className="hover:text-red-500 dark:hover:text-white"/></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-xs space-y-2">
                   {data.recentActivity.map((log) => (
                      <div key={log.id} className="flex gap-4 p-1 hover:bg-gray-100 dark:hover:bg-green-900/20 border-b border-dashed border-gray-200 dark:border-green-900/30 last:border-0">
                         <span className="text-gray-500 dark:text-green-700">{new Date(log.createdAt).toLocaleTimeString()}</span>
                         <span className="text-gray-900 dark:text-white w-1/3 truncate font-bold">{log.originalName}</span>
                         <span className="text-blue-600 dark:text-cyan-500">{log.uploadedBy.name}</span>
                         <span className="text-orange-600 dark:text-yellow-500 ml-auto">{formatBytes(log.size)}</span>
                      </div>
                   ))}
                </div>
             </motion.div>
          )}
        </AnimatePresence>

        {/* 3. USER LIST (ls users) */}
        <AnimatePresence>
           {modules.users && (
              <motion.div 
                 initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
                 className="lg:col-span-4 border border-gray-300 dark:border-green-900 bg-white dark:bg-black/40 p-4 h-[400px] flex flex-col shadow-sm dark:shadow-none"
              >
                 <div className="flex items-center justify-between border-b border-gray-200 dark:border-green-900 pb-2 mb-2">
                    <h3 className="text-sm font-bold uppercase flex items-center gap-2 text-gray-700 dark:text-green-400"><Globe size={14}/> PERSONNEL_LOG</h3>
                    <button onClick={() => toggleModule('users', false)}><X size={14} className="hover:text-red-500 dark:hover:text-white"/></button>
                 </div>
                 <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-xs space-y-2">
                    {data.recentUsers.map((user) => (
                       <div key={user.id} className="p-2 border border-gray-200 dark:border-green-900/30 hover:border-blue-400 dark:hover:border-green-500 transition-colors bg-gray-50 dark:bg-transparent">
                          <div className="flex justify-between">
                             <span className="text-gray-900 dark:text-white font-bold">{user.name}</span>
                             <span className={`px-1 rounded text-[10px] ${user.role === 'admin' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-500' : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-500'}`}>{user.role}</span>
                          </div>
                          <div className="text-gray-500 dark:text-green-800 mt-1">LAST_SEEN: {formatDistanceToNow(new Date(user.updatedAt))} ago</div>
                       </div>
                    ))}
                 </div>
              </motion.div>
           )}
        </AnimatePresence>

        {/* 4. STORAGE BREAKDOWN (ls storage) */}
        <AnimatePresence>
           {modules.storage && (
              <motion.div 
                 initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
                 className="lg:col-span-12 border-t border-gray-300 dark:border-green-900 pt-4 mt-4 grid grid-cols-2 md:grid-cols-4 gap-4"
              >
                  <CyberBar label="IMG" count={data.breakdown.images} total={data.storage.totalAssets} color="bg-blue-500 dark:bg-green-500" />
                  <CyberBar label="VID" count={data.breakdown.videos} total={data.storage.totalAssets} color="bg-red-500 dark:bg-red-500" />
                  <CyberBar label="DOC" count={data.breakdown.docs} total={data.storage.totalAssets} color="bg-orange-500 dark:bg-yellow-500" />
                  <CyberBar label="AUD" count={data.breakdown.audio} total={data.storage.totalAssets} color="bg-purple-500 dark:bg-purple-500" />
              </motion.div>
           )}
        </AnimatePresence>

      </div>

      {/* ❌ TERMINAL REMOVED FROM HERE 
          It now lives in App.tsx via GlobalTerminal.tsx 
      */}

    </div>
  );
};

// --- SUB COMPONENTS ---

const CyberCard: React.FC<CyberCardProps> = ({ label, value, icon, sub, color, onClick }) => {
  const iconColor = color || "text-gray-400 dark:text-green-400";
  
  return (
    <div 
        onClick={onClick}
        className={`border border-gray-300 dark:border-green-900 bg-white dark:bg-green-900/10 p-4 relative overflow-hidden shadow-sm dark:shadow-none transition-all ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-green-900/20 active:scale-[0.98]' : ''}`}
    >
      <div className={`absolute -right-2 -top-2 opacity-10 ${iconColor}`}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 60 })}
      </div>
      
      {onClick && <ExternalLink size={12} className="absolute top-2 right-2 text-gray-400 dark:text-green-600" />}

      <p className="text-[10px] font-bold text-gray-500 dark:text-green-700 uppercase mb-1">{label}</p>
      <div className={`text-2xl font-black text-gray-900 dark:text-white`}>{value}</div>
      <div className={`text-xs text-gray-400 dark:text-green-600 opacity-80 mt-1`}>&gt; {sub}</div>
    </div>
  );
};

const CyberBar: React.FC<CyberBarProps> = ({ label, count, total, color = "bg-green-500" }) => {
   const pct = total > 0 ? (count / total) * 100 : 0;
   return (
      <div className="bg-white dark:bg-green-900/10 p-2 border border-gray-300 dark:border-green-900/30 shadow-sm dark:shadow-none">
         <div className="flex justify-between text-xs mb-1 text-gray-600 dark:text-green-500">
            <span>{label}</span>
            <span>{Math.round(pct)}%</span>
         </div>
         <div className="h-2 bg-gray-200 dark:bg-green-900/30 w-full overflow-hidden rounded-sm">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full ${color}`} />
         </div>
      </div>
   )
}

export default AdminAnalytics;