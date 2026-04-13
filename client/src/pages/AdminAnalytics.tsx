import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { 
  HardDrive, Users, FileVideo, FileImage, Activity, 
  FileText, Music, Box, Globe, Clock, ChevronRight,
  X, Search, UserX, UserCheck, Trophy
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- TYPES ---
interface AnalyticsData {
  storage: { totalBytes: number; totalAssets: number };
  users: { total: number; admins: number; editors: number; viewers: number };
  breakdown: { images: number; videos: number; audio: number; docs: number; others: number };
  recentActivity: Array<{ id: string; originalName: string; size: number; createdAt: string; uploadedBy: { name: string } }>;
  visits: { total: number };
  allUsers: Array<{ id: string; name: string; email: string; avatar: string; role: string; lastActive: string | null }>;
  topUploaders: Array<{ id: string; name: string; avatar: string; _count: { assets: number } }>;
  recentUserLogs: Array<{ id: string; action: string; details: string; createdAt: string; user: { name: string; email: string; avatar?: string } }>;
}

const trendData = [
    { name: 'Mon', uploads: 4, downloads: 12 },
    { name: 'Tue', uploads: 7, downloads: 18 },
    { name: 'Wed', uploads: 2, downloads: 9 },
    { name: 'Thu', uploads: 15, downloads: 30 },
    { name: 'Fri', uploads: 8, downloads: 22 },
    { name: 'Sat', uploads: 1, downloads: 5 },
    { name: 'Sun', uploads: 0, downloads: 8 },
];

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const AdminAnalytics = () => {
  const navigate = useNavigate();

  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState<'audit' | 'top' | 'active' | 'inactive'>('audit');
  const [showDirectory, setShowDirectory] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [specificLogs, setSpecificLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // --- DATA FETCHING ---
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const res = await client.get('/analytics');
      return res.data;
    },
    refetchInterval: 10000 
  });

  const handleUserClick = async (user: any) => {
      setSelectedUser(user);
      setShowDirectory(true); 
      setLoadingLogs(true);
      try {
          const res = await client.get(`/analytics/user/${user.id}`);
          setSpecificLogs(res.data);
      } catch (err) {
          console.error("Failed to fetch user logs", err);
      } finally {
          setLoadingLogs(false);
      }
  };

  const getActionColor = (action: string) => {
      switch (action?.toUpperCase()) {
          case 'DOWNLOAD': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400';
          case 'LOGIN': return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400';
          case 'VIEW_ASSET': return 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400';
          default: return 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300';
      }
  };

  // --- DERIVED DATA FOR LISTS ---
  const activeUsers = [...(data?.allUsers || [])]
      .filter(u => u.lastActive)
      .sort((a, b) => new Date(b.lastActive!).getTime() - new Date(a.lastActive!).getTime())
      .slice(0, 15);

  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const inactiveUsers = [...(data?.allUsers || [])]
      .filter(u => !u.lastActive || new Date(u.lastActive) < oneMonthAgo)
      .sort((a, b) => {
          if (!a.lastActive) return -1; 
          if (!b.lastActive) return 1;
          return new Date(a.lastActive).getTime() - new Date(b.lastActive).getTime();
      })
      .slice(0, 15);

  if (isLoading || !data) return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] flex items-center justify-center">
       <div className="flex flex-col items-center gap-3">
           <Activity size={32} className="text-blue-500 animate-pulse" />
           <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm">Aggregating Metrics...</p>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] p-4 lg:p-8 pb-24 transition-colors duration-500 relative font-sans">
      
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-400/10 dark:bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-400/10 dark:bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-6">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-1 text-gray-900 dark:text-white">
                    Analytics Overview
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Real-time insights, storage metrics, and workspace activity.
                </p>
            </div>
            <div className="flex items-center gap-2 bg-white/60 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 px-4 py-2 rounded-xl shadow-sm">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">System Online</span>
            </div>
        </div>

        {/* --- ROW 1: CORE KPIs --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <BentoCard title="Total Storage Used" value={formatBytes(data.storage.totalBytes)} icon={<HardDrive size={20} className="text-blue-500" />} subtitle={`${data.storage.totalAssets} files hosted`} onClick={() => navigate('/library')} />
            <BentoCard title="Workspace Members" value={data.users.total} icon={<Users size={20} className="text-purple-500" />} subtitle={`${data.users.admins} Admins • ${data.users.editors} Editors`} onClick={() => navigate('/users')} />
            <BentoCard title="Total Site Visits" value={data.visits?.total || 0} icon={<Globe size={20} className="text-emerald-500" />} subtitle="Click to view User Directory" onClick={() => setShowDirectory(true)} />
            <BentoCard title="Media Assets" value={data.breakdown.images + data.breakdown.videos} icon={<Box size={20} className="text-orange-500" />} subtitle="Images and Videos" />
        </div>

        {/* --- ROW 2: STORAGE COMPOSITION --- */}
        <div className="bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/5 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                <Activity size={16} className="text-blue-500" /> Storage Composition
            </h3>
            <div className="w-full h-6 flex rounded-full overflow-hidden mb-6 shadow-inner bg-gray-100 dark:bg-black/40">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(data.breakdown.images / data.storage.totalAssets) * 100}%` }} className="h-full bg-blue-500" title="Images" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${(data.breakdown.videos / data.storage.totalAssets) * 100}%` }} className="h-full bg-pink-500" title="Videos" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${(data.breakdown.docs / data.storage.totalAssets) * 100}%` }} className="h-full bg-amber-500" title="Documents" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${(data.breakdown.audio / data.storage.totalAssets) * 100}%` }} className="h-full bg-purple-500" title="Audio" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${(data.breakdown.others / data.storage.totalAssets) * 100}%` }} className="h-full bg-gray-400" title="Other" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <LegendItem label="Images" count={data.breakdown.images} total={data.storage.totalAssets} color="bg-blue-500" icon={<FileImage size={14}/>} />
                <LegendItem label="Videos" count={data.breakdown.videos} total={data.storage.totalAssets} color="bg-pink-500" icon={<FileVideo size={14}/>} />
                <LegendItem label="Documents" count={data.breakdown.docs} total={data.storage.totalAssets} color="bg-amber-500" icon={<FileText size={14}/>} />
                <LegendItem label="Audio" count={data.breakdown.audio} total={data.storage.totalAssets} color="bg-purple-500" icon={<Music size={14}/>} />
                <LegendItem label="Others" count={data.breakdown.others} total={data.storage.totalAssets} color="bg-gray-400" icon={<Box size={14}/>} />
            </div>
        </div>

        {/* --- ROW 3: CHART --- */}
        <div className="bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/5 rounded-3xl p-6 shadow-sm mb-6">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                <Activity size={16} className="text-pink-500" /> Platform Activity (7 Days)
            </h3>
            <div className="h-[250px] w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} opacity={0.2} />
                        <XAxis dataKey="name" stroke="#888" tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke="#888" tickLine={false} axisLine={false} dx={-10} />
                        <Tooltip contentStyle={{ backgroundColor: '#1A1D21', borderRadius: '12px', border: 'none', color: '#fff' }} itemStyle={{ fontWeight: 'bold' }} />
                        <Line type="monotone" dataKey="downloads" name="Downloads" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="uploads" name="Uploads" stroke="#ec4899" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* --- ROW 4: TABBED DATA CENTER --- */}
        <div className="bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/5 rounded-3xl shadow-sm mb-6 overflow-hidden">
            
            {/* Tabs Header - CENTERED */}
            <div className="flex items-center justify-center gap-2 p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 overflow-x-auto custom-scrollbar">
                <TabButton id="audit" active={activeTab} onClick={setActiveTab} icon={<Clock size={16} />} label="Live Audit Trail" />
                <TabButton id="top" active={activeTab} onClick={setActiveTab} icon={<Trophy size={16} />} label="Top Uploaders" />
                <TabButton id="active" active={activeTab} onClick={setActiveTab} icon={<UserCheck size={16} />} label="Active Personnel" />
                <TabButton id="inactive" active={activeTab} onClick={setActiveTab} icon={<UserX size={16} />} label="Needs Attention" badge={inactiveUsers.length} />
            </div>

            <div className="p-4 sm:p-6 overflow-hidden min-h-[500px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        
                        {/* 1. LIVE AUDIT TRAIL (Horizontal Name List) */}
                        {activeTab === 'audit' && (
                            <div className="flex flex-row flex-wrap gap-3">
                                {(!data.recentUserLogs || data.recentUserLogs.length === 0) ? <EmptyState icon={<Activity/>} message="No recent activity found." /> : 
                                Array.from(new Set(data.recentUserLogs.map(log => log.user.email)))
                                    .map(email => data.allUsers?.find(u => u.email === email))
                                    .filter(Boolean)
                                    .map((user: any) => (
                                        <div 
                                            key={user.id} 
                                            onClick={() => handleUserClick(user)} 
                                            className="flex items-center gap-3 p-2 pr-5 bg-white dark:bg-black/20 hover:bg-blue-50 dark:hover:bg-blue-500/10 border border-gray-200 dark:border-white/5 rounded-full cursor-pointer transition-all hover:shadow-sm group shadow-sm"
                                        >
                                            <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/10" alt="avatar" />
                                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">{user.name}</span>
                                        </div>
                                ))}
                            </div>
                        )}

                        {/* 2. TOP UPLOADERS */}
                        {activeTab === 'top' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {(!data.topUploaders || data.topUploaders.length === 0) ? <EmptyState icon={<Trophy/>} message="No uploads recorded yet." /> : 
                                data.topUploaders.map((user) => (
                                    <div key={user.id} onClick={() => handleUserClick(user)} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-2xl transition-colors cursor-pointer group border border-gray-100 dark:border-white/5">
                                        <div className="relative">
                                            <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} className="w-12 h-12 rounded-full border border-gray-200 dark:border-white/10" alt="avatar" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-yellow-500 transition-colors truncate">{user.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                <HardDrive size={12}/> Contributed <strong className="text-gray-800 dark:text-gray-200">{user._count.assets}</strong> assets
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 3. ACTIVE PERSONNEL */}
                        {activeTab === 'active' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {activeUsers.length === 0 ? <EmptyState icon={<UserCheck/>} message="No users currently active." /> : 
                                activeUsers.map((user) => (
                                    <div key={user.id} onClick={() => handleUserClick(user)} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-black/20 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-2xl transition-colors cursor-pointer border border-gray-100 dark:border-white/5">
                                        <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} className="w-10 h-10 rounded-full border border-gray-200 dark:border-white/10" alt="avatar" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
                                            <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                {formatDistanceToNow(new Date(user.lastActive!))} ago
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 4. NEEDS ATTENTION (Inactive) */}
                        {activeTab === 'inactive' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {inactiveUsers.length === 0 ? <EmptyState icon={<Activity/>} message="Everyone is actively engaging with the workspace! 🎉" /> : 
                                inactiveUsers.map((user) => (
                                    <div key={user.id} onClick={() => handleUserClick(user)} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-black/20 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-colors cursor-pointer border border-gray-100 dark:border-white/5 group">
                                        <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} className="w-10 h-10 rounded-full grayscale group-hover:grayscale-0 transition-all border border-gray-200 dark:border-white/10" alt="avatar" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-red-500">{user.name}</p>
                                            <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-500 mt-0.5">
                                                {user.lastActive ? `Inactive for ${formatDistanceToNow(new Date(user.lastActive))}` : 'Never Logged In'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
      </div>

      {/* =========================================
          MODAL: USER DIRECTORY & SPECIFIC LOGS
          ========================================= */}
      {showDirectory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black/20">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white">
                            {selectedUser ? `${selectedUser.name}'s Audit Trail` : "Workspace Personnel Directory"}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {selectedUser ? "Complete history of all actions taken by this user." : "Select a user to view their complete activity history."}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {selectedUser && (
                            <button onClick={() => setSelectedUser(null)} className="text-sm font-bold text-blue-500 hover:text-blue-600 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl transition-colors">
                                ← Back to Directory
                            </button>
                        )}
                        <button onClick={() => { setShowDirectory(false); setSelectedUser(null); }} className="p-2 bg-gray-200 dark:bg-white/10 rounded-full hover:bg-red-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden relative">
                    
                    {/* VIEW 1: ALL USERS LIST */}
                    {!selectedUser && (
                        <div className="absolute inset-0 flex flex-col p-6">
                            <div className="relative mb-4">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Search users..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-3 pr-2">
                                {data.allUsers && data.allUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).map(user => (
                                    <div key={user.id} onClick={() => handleUserClick(user)} className="flex items-center gap-4 p-4 border border-gray-100 dark:border-white/5 rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer bg-white dark:bg-white/5 transition-all group">
                                        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-black/50 overflow-hidden shrink-0 border border-gray-300 dark:border-white/10">
                                            {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="Avatar"/> : <div className="w-full h-full flex items-center justify-center font-black text-gray-500 dark:text-gray-400">{user.name.charAt(0)}</div>}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">{user.name}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                {user.lastActive ? <><Clock size={10}/> Active {formatDistanceToNow(new Date(user.lastActive))} ago</> : 'Never active'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* VIEW 2: SPECIFIC USER TIMELINE */}
                    {selectedUser && (
                        <div className="absolute inset-0 p-6 overflow-y-auto custom-scrollbar">
                            {loadingLogs ? (
                                <div className="h-full flex items-center justify-center text-blue-500"><Activity className="animate-pulse" size={32} /></div>
                            ) : specificLogs.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-gray-500 font-bold">No actions recorded for this user yet.</div>
                            ) : (
                                <div className="space-y-4">
                                    {specificLogs.map((log) => (
                                        <div key={log.id} className="flex gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                            <div className="w-24 shrink-0 text-xs font-bold text-gray-400 pt-1">
                                                {new Date(log.createdAt).toLocaleDateString()}<br/>
                                                <span className="text-gray-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                            </div>
                                            <div className="flex-1">
                                                <span className={`text-xs font-black uppercase tracking-wider px-2 py-1 rounded-md inline-block mb-2 ${getActionColor(log.action)}`}>
                                                    {log.action}
                                                </span>
                                                <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{log.details}</p>
                                                {log.action === 'SESSION_TIME' && log.duration && (
                                                    <p className="text-xs text-blue-500 mt-1 font-bold">+ {Math.floor(log.duration / 60)} minutes browsed</p>
                                                )}
                                                {log.asset?.originalName && (
                                                    <p className="text-xs text-purple-500 mt-1 font-mono">{log.asset.originalName}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
      )}

    </div>
  );
};

// --- SUB COMPONENTS ---

const TabButton = ({ id, active, onClick, icon, label, badge }: any) => (
    <button
        onClick={() => onClick(id)}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
            active === id 
                ? 'bg-white dark:bg-[#1A1D21] text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-white/10' 
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent'
        }`}
    >
        {icon} {label}
        {badge !== undefined && badge > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-black ${active === id ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                {badge}
            </span>
        )}
    </button>
);

const EmptyState = ({ icon, message }: any) => (
    <div className="flex flex-col items-center justify-center p-12 text-gray-400 opacity-60">
        <div className="mb-3 scale-150">{icon}</div>
        <p className="text-sm font-medium">{message}</p>
    </div>
);

const BentoCard = ({ title, value, icon, subtitle, onClick }: any) => (
    <div 
        onClick={onClick}
        className={`bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/5 p-6 rounded-3xl shadow-sm transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-1 hover:border-blue-300 dark:hover:border-white/10' : ''}`}
    >
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-white/5">
                {icon}
            </div>
            {onClick && <ChevronRight size={16} className="text-gray-400" />}
        </div>
        <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">{title}</p>
            <h3 className="text-3xl font-black text-gray-900 dark:text-white">{value}</h3>
            {subtitle && <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 font-medium">{subtitle}</p>}
        </div>
    </div>
);

const LegendItem = ({ label, count, total, color, icon }: any) => {
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    return (
        <div className="flex flex-col gap-1 p-3 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5">
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
                <div className={`w-2 h-2 rounded-full ${color}`} />
                {icon} {label}
            </div>
            <div className="text-lg font-black text-gray-900 dark:text-white mt-1">{count}</div>
            <div className="text-xs text-gray-500 dark:text-gray-500">{pct}% of total</div>
        </div>
    );
};

export default AdminAnalytics;