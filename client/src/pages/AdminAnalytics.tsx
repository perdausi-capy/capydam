import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, HardDrive, Users, FileImage, Search, ArrowUpRight, X, AlertTriangle, ChevronLeft, UploadCloud, DownloadCloud, Edit3, Trash2, Zap, Moon } from 'lucide-react';

// --- TYPES ---
interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  uploads: number;
  createdDaysAgo: number;
  lastActive: string | null;
}

interface AuditLog {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  user: { name: string; email: string; avatar: string | null };
  assetId?: string;
  asset?: { originalName: string };
}

interface AnalyticsData {
  storage: { totalBytes: number; totalAssets: number };
  breakdown: { images: number; videos: number; audio: number; docs: number; others: number };
  users: { total: number; admins: number; editors: number; viewers: number };
  actionTotals: { UPLOAD: number; DOWNLOAD: number; EDIT: number; DELETE: number; OPEN_LINK: number }; 
  recentUserLogs: AuditLog[];
  allUsers: User[];
  velocityChart: {
    weekly: Array<{ name: string; uploads: number; downloads: number; links: number }>;
    monthly: Array<{ name: string; uploads: number; downloads: number; links: number }>;
    yearly: Array<{ name: string; uploads: number; downloads: number; links: number }>;
  };
}

// --- UTILS ---
const formatBytes = (bytes: number) => {
  if (bytes === 0) return { val: '0', unit: 'B' };
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return { val: parseFloat((bytes / Math.pow(k, i)).toFixed(1)), unit: sizes[i] };
};

const getBadgeStyle = (action: string) => {
  const act = action.toUpperCase();
  if (act.includes('DELETE')) return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (act.includes('UPLOAD')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  if (act.includes('DOWNLOAD')) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  if (act.includes('EDIT') || act.includes('UPDATE')) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
  if (act.includes('LINK')) return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
  return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
};

// 🚨 NEW: 3-Tier Engagement Engine
const getUserEngagement = (u: User) => {
  const daysSince = !u.lastActive ? u.createdDaysAgo : differenceInDays(new Date(), new Date(u.lastActive));
  
  if (!u.lastActive || daysSince >= 60) {
    return { tier: 'GHOST', label: 'Rare / Ghost', color: 'text-red-500 bg-red-500/10 border-red-500/20', daysSince };
  }
  if (daysSince >= 30) {
    return { tier: 'AT_RISK', label: 'Occasional', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20', daysSince };
  }
  return { tier: 'FREQUENT', label: 'Frequent', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', daysSince };
};

const renderActionLink = (log: AuditLog) => {
  const act = log.action.toUpperCase();
  const isDelete = act.includes('DELETE') || act.includes('REMOVE');
  const isEdit = act.includes('EDIT') || act.includes('UPDATE') || act.includes('RENAME');

  if (isDelete) {
     return (
       <Link 
         to="/admin/recycle-bin"
         className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 border border-transparent hover:border-red-500/30 rounded-md text-red-400 hover:text-red-300 text-xs font-semibold transition-all shrink-0"
         onClick={(e) => e.stopPropagation()}
       >
         <span>Recycle Bin</span>
         <ArrowUpRight size={12} />
       </Link>
     );
  }

  if (log.assetId) {
     return (
       <Link 
         to={`/assets/${log.assetId}`}
         className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-blue-500/20 border border-transparent hover:border-blue-500/30 rounded-md text-gray-400 hover:text-blue-400 text-xs font-semibold transition-all shrink-0"
         onClick={(e) => e.stopPropagation()}
       >
         <span>{isEdit ? 'View Edit' : 'Locate'}</span>
         <ArrowUpRight size={12} />
       </Link>
     );
  }

  return (
    <span 
      className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.02] border border-white/5 rounded-md text-gray-600 text-[10px] font-mono cursor-not-allowed shrink-0" 
      title="This log was saved before ID tracking was enabled."
    >
      Legacy Log
    </span>
  );
};

const AdminAnalytics = () => {
  const [searchTerm, setSearchTerm] = useState('');
  // 🚨 NEW: 3-Tier State
  const [userTab, setUserTab] = useState<'FREQUENT' | 'AT_RISK' | 'GHOST'>('FREQUENT');
  const [timeRange, setTimeRange] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['admin-analytics'],
    queryFn: async () => (await client.get('/analytics')).data,
    refetchInterval: 15000 
  });

  const { data: userLogs, isLoading: isLoadingLogs } = useQuery<AuditLog[]>({
    queryKey: ['user-logs', selectedUser?.id],
    queryFn: async () => (await client.get(`/analytics/user/${selectedUser?.id}`)).data,
    enabled: !!selectedUser
  });

  const { storageData, frequentUsers, atRiskUsers, ghostUsers, filteredLogs, chartData } = useMemo(() => {
    if (!data) return { storageData: { val: '0', unit: 'B', pct: 0 }, frequentUsers: [], atRiskUsers: [], ghostUsers: [], filteredLogs: [], chartData: [] };

    const sData = formatBytes(data.storage.totalBytes);
    const sPct = data.storage.totalBytes > 0 ? Math.min(100, (data.storage.totalBytes / (500 * 1024 * 1024 * 1024)) * 100).toFixed(0) : 0;

    // 🚨 NEW: Bucket and Sort Users exactly like our Database Investigation
    const freq = data.allUsers.filter(u => getUserEngagement(u).tier === 'FREQUENT').sort((a, b) => b.uploads - a.uploads);
    const risk = data.allUsers.filter(u => getUserEngagement(u).tier === 'AT_RISK').sort((a, b) => getUserEngagement(b).daysSince - getUserEngagement(a).daysSince);
    const ghost = data.allUsers.filter(u => getUserEngagement(u).tier === 'GHOST').sort((a, b) => getUserEngagement(b).daysSince - getUserEngagement(a).daysSince);

    const logs = data.recentUserLogs.filter(log => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return log.user.name.toLowerCase().includes(term) || log.action.toLowerCase().includes(term) || log.asset?.originalName?.toLowerCase().includes(term);
    });

    return { 
        storageData: { ...sData, pct: Number(sPct) }, 
        frequentUsers: freq, 
        atRiskUsers: risk,
        ghostUsers: ghost,
        filteredLogs: logs,
        chartData: data.velocityChart ? data.velocityChart[timeRange] : []
    };
  }, [data, searchTerm, timeRange]);

  const closeRosterModal = () => {
    setShowRosterModal(false);
    setTimeout(() => setSelectedUser(null), 300); 
  };

  const getActiveTabUsers = () => {
      if (userTab === 'FREQUENT') return frequentUsers;
      if (userTab === 'AT_RISK') return atRiskUsers;
      return ghostUsers;
  };

  if (isLoading || !data) return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-gray-400">
       <Activity className="animate-spin mr-3" size={20} /> Loading Analytics...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-200 font-sans pb-24">
      
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/10 px-8 py-4">
        <h1 className="text-xl font-semibold text-white tracking-tight">Platform Analytics</h1>
        <p className="text-sm text-gray-500">Monitor storage, asset health, and personnel activity.</p>
      </div>

      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">

        {/* 1. TOP METRICS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#121212] border border-white/5 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <span className="text-sm font-medium text-gray-400">Total Storage</span>
              <HardDrive size={16} className="text-gray-500" />
            </div>
            <div className="text-3xl font-semibold text-white tracking-tight mb-2">
              {storageData.val} <span className="text-lg text-gray-500 font-normal">{storageData.unit}</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5 mb-1">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${storageData.pct}%` }}></div>
            </div>
            <span className="text-xs text-gray-500">{storageData.pct}% of total capacity used</span>
          </div>

          <div className="bg-[#121212] border border-white/5 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <span className="text-sm font-medium text-gray-400">Indexed Assets</span>
              <FileImage size={16} className="text-gray-500" />
            </div>
            <div className="text-3xl font-semibold text-white tracking-tight mb-2">
              {data.storage.totalAssets.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-emerald-500 font-medium">
              <ArrowUpRight size={14} className="mr-1" /> Active indexing
            </div>
          </div>

          <div className="bg-[#121212] border border-white/5 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <span className="text-sm font-medium text-gray-400">Active Personnel</span>
              <Users size={16} className="text-gray-500" />
            </div>
            <div className="text-3xl font-semibold text-white tracking-tight mb-2">
              {frequentUsers.length} <span className="text-lg text-gray-500 font-normal">/ {data.users.total}</span>
            </div>
            <div className="text-xs text-gray-500 space-x-2">
              <span>{data.users.admins} Admins</span>
              <span>•</span>
              <span>{data.users.editors} Editors</span>
            </div>
          </div>

          <div className="bg-[#121212] border border-white/5 rounded-xl p-5 shadow-sm">
             <div className="flex justify-between items-start mb-4">
              <span className="text-sm font-medium text-gray-400">System Health</span>
              <Activity size={16} className="text-gray-500" />
            </div>
            <div className="text-3xl font-semibold text-white tracking-tight mb-2">Stable</div>
            <div className="flex items-center text-xs text-emerald-500 font-medium">
              Database & Storage Synced
            </div>
          </div>
        </div>

        {/* 2. LIFETIME ACTION TRACKER */}
        {data.actionTotals && (
          <div className="bg-[#121212] border border-white/5 rounded-xl p-2 shadow-sm grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/5">
             <div className="flex items-center gap-4 p-3 md:px-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                   <UploadCloud className="text-emerald-500" size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Uploads</p>
                  <p className="text-lg font-semibold text-white">{data.actionTotals.UPLOAD.toLocaleString()}</p>
                </div>
             </div>
             <div className="flex items-center gap-4 p-3 md:px-6">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                   <DownloadCloud className="text-blue-500" size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Downloads</p>
                  <p className="text-lg font-semibold text-white">{data.actionTotals.DOWNLOAD.toLocaleString()}</p>
                </div>
             </div>
             <div className="flex items-center gap-4 p-3 md:px-6">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                   <Edit3 className="text-orange-500" size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Edits</p>
                  <p className="text-lg font-semibold text-white">{data.actionTotals.EDIT.toLocaleString()}</p>
                </div>
             </div>
             <div className="flex items-center gap-4 p-3 md:px-6">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20">
                   <Trash2 className="text-red-500" size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Deletions</p>
                  <p className="text-lg font-semibold text-white">{data.actionTotals.DELETE.toLocaleString()}</p>
                </div>
             </div>
          </div>
        )}

        {/* 3. PLATFORM VELOCITY CHART */}
        <div className="bg-[#121212] border border-white/5 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Platform Velocity</h2>
              <p className="text-xs text-gray-500 mt-1 mb-3">Ingestion vs. extraction rates over time.</p>
              
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1.5">
                   <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                   <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Uploads</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
                   <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Downloads</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]"></span>
                   <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Source Links</span>
                 </div>
              </div>
            </div>
            
            <div className="flex bg-[#0A0A0A] p-0.5 rounded-lg border border-white/5">
              {['weekly', 'monthly', 'yearly'].map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range as any)}
                  className={`px-3 py-1 text-xs rounded-md font-medium capitalize transition-all ${timeRange === range ? 'bg-[#2A2A2A] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[280px] w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorLink" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                <XAxis dataKey="name" stroke="#52525b" tick={{ fill: '#71717a' }} tickLine={false} axisLine={false} dy={10} minTickGap={20} />
                <YAxis stroke="#52525b" tick={{ fill: '#71717a' }} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', padding: '12px' }} 
                  itemStyle={{ color: '#e5e5e5' }}
                  labelStyle={{ color: '#a1a1aa', marginBottom: '8px', fontWeight: '500' }}
                  cursor={{ stroke: '#262626', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="downloads" name="Downloads" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorDownload)" activeDot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }} />
                <Area type="monotone" dataKey="uploads" name="Uploads" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorUpload)" activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }} />
                <Area type="monotone" dataKey="links" name="Source Links" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorLink)" activeDot={{ r: 4, strokeWidth: 0, fill: '#8b5cf6' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. ASSETS & USER ENGAGEMENT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#121212] border border-white/5 rounded-xl p-5 shadow-sm flex flex-col h-[420px]">
            <div>
              <h2 className="text-sm font-semibold text-white">Asset Composition</h2>
              <p className="text-xs text-gray-500 mt-1 mb-6">Visual breakdown of indexed file types.</p>
            </div>
            
            <div className="flex-1 flex flex-col justify-center items-center">
               <div className="h-[200px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie
                         data={[
                           { name: 'Images', value: data.breakdown.images, color: '#3b82f6' },
                           { name: 'Videos', value: data.breakdown.videos, color: '#a855f7' },
                           { name: 'Documents', value: data.breakdown.docs, color: '#10b981' },
                           { name: 'Others', value: data.breakdown.others, color: '#6b7280' },
                         ]}
                         cx="50%"
                         cy="50%"
                         innerRadius={65}
                         outerRadius={85}
                         paddingAngle={5}
                         dataKey="value"
                         stroke="none"
                         cornerRadius={4}
                       >
                         {[
                           { name: 'Images', color: '#3b82f6' },
                           { name: 'Videos', color: '#a855f7' },
                           { name: 'Documents', color: '#10b981' },
                           { name: 'Others', color: '#6b7280' },
                         ].map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} />
                         ))}
                       </Pie>
                       <Tooltip 
                         contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', padding: '8px 12px' }} 
                         itemStyle={{ color: '#e5e5e5', fontSize: '12px', fontWeight: '500' }}
                         formatter={(value: any) => [value?.toLocaleString() || '0', 'Assets']}
                       />
                     </PieChart>
                  </ResponsiveContainer>

                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-3xl font-bold text-white tracking-tight leading-none">
                        {data.storage.totalAssets.toLocaleString()}
                     </span>
                     <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                        Total
                     </span>
                  </div>
               </div>

               <div className="w-full mt-8 grid grid-cols-2 gap-y-4 gap-x-6 px-2">
                  {[
                    { label: 'Images', count: data.breakdown.images, color: '#3b82f6' },
                    { label: 'Videos', count: data.breakdown.videos, color: '#a855f7' },
                    { label: 'Documents', count: data.breakdown.docs, color: '#10b981' },
                    { label: 'Others', count: data.breakdown.others, color: '#6b7280' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}80` }}
                        ></span>
                        <span className="text-xs text-gray-400 font-medium">{item.label}</span>
                      </div>
                      <span className="text-xs text-gray-200 font-semibold">{item.count.toLocaleString()}</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-[#121212] border border-white/5 rounded-xl flex flex-col shadow-sm h-[420px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-white/5 gap-4 shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-white">Personnel Engagement</h2>
                <p className="text-xs text-gray-500 mt-1">Snapshot of user activity based on real login data.</p>
              </div>
              {/* 🚨 NEW: 3-Tier Tab Controls */}
              <div className="flex bg-[#0A0A0A] p-0.5 rounded-lg border border-white/5 shrink-0 overflow-x-auto custom-scrollbar">
                <button onClick={() => setUserTab('FREQUENT')} className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${userTab === 'FREQUENT' ? 'bg-[#2A2A2A] text-emerald-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
                  <Zap size={12}/> Frequent ({frequentUsers.length})
                </button>
                <button onClick={() => setUserTab('AT_RISK')} className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${userTab === 'AT_RISK' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'text-gray-500 hover:text-gray-300'}`}>
                  <AlertTriangle size={12}/> Occasional ({atRiskUsers.length})
                </button>
                <button onClick={() => setUserTab('GHOST')} className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${userTab === 'GHOST' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-gray-500 hover:text-gray-300'}`}>
                  <Moon size={12}/> Ghosts ({ghostUsers.length})
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
               <table className="w-full text-left text-sm whitespace-nowrap">
                 <thead>
                   <tr className="text-gray-500 border-b border-white/5">
                     <th className="font-medium px-4 py-3">User</th>
                     <th className="font-medium px-4 py-3">Role</th>
                     <th className="font-medium px-4 py-3 text-right">Uploads</th>
                     <th className="font-medium px-4 py-3 text-right">Status / Last Active</th>
                   </tr>
                 </thead>
                 <tbody>
                   <AnimatePresence mode="popLayout">
                     {getActiveTabUsers().slice(0, 5).map((u) => {
                       const engagement = getUserEngagement(u);
                       
                       return (
                       <motion.tr 
                         key={u.id}
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         exit={{ opacity: 0 }}
                         className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                       >
                         <td className="px-4 py-3 flex items-center gap-3 min-w-[150px]">
                           {u.avatar ? <img src={u.avatar} className="w-8 h-8 rounded-full object-cover border border-white/10" /> : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-gray-300">{u.name.charAt(0)}</div>}
                           <span className="font-medium text-gray-200 truncate">{u.name}</span>
                         </td>
                         <td className="px-4 py-3 text-gray-400 capitalize">{u.role}</td>
                         <td className="px-4 py-3 text-right font-medium text-gray-200">{u.uploads}</td>
                         <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${engagement.color}`}>
                              {engagement.label} ({engagement.daysSince}d)
                            </span>
                         </td>
                       </motion.tr>
                     )})}
                   </AnimatePresence>
                 </tbody>
               </table>
            </div>

            <div className="p-3 border-t border-white/5 bg-[#0A0A0A]/50 shrink-0">
               <button 
                 onClick={() => setShowRosterModal(true)}
                 className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium rounded-lg transition-colors border border-white/10"
               >
                 View Full Roster ({data.allUsers.length} Users)
               </button>
            </div>
          </div>
        </div>

        {/* 5. BOTTOM SECTION: GLOBAL AUDIT LOGS */}
        <div className="bg-[#121212] border border-white/5 rounded-xl shadow-sm flex flex-col h-[500px]">
          <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Global Audit Trail</h2>
              <p className="text-xs text-gray-500 mt-1">Real-time log of all platform actions.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input 
                type="text" 
                placeholder="Search logs..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-white/10 text-sm text-white rounded-lg pl-9 pr-4 py-2 outline-none focus:border-white/30 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
               <thead>
                 <tr className="text-gray-500 border-b border-white/5 sticky top-0 bg-[#121212] z-10">
                   <th className="font-medium px-4 py-3 w-40">Timestamp</th>
                   <th className="font-medium px-4 py-3 w-48">User</th>
                   <th className="font-medium px-4 py-3 w-32">Action</th>
                   <th className="font-medium px-4 py-3">Target / Details</th>
                 </tr>
               </thead>
               <tbody>
                 {filteredLogs.map(log => (
                   <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                     <td className="px-4 py-3 text-gray-500">
                       {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                     </td>
                     <td className="px-4 py-3 font-medium text-gray-300">
                       {log.user.name}
                     </td>
                     <td className="px-4 py-3">
                       <span className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${getBadgeStyle(log.action)}`}>
                         {log.action.replace('_', ' ')}
                       </span>
                     </td>
                     <td className="px-4 py-3 text-gray-400">
                        <div className="flex items-center justify-between gap-4 w-full">
                           <span className="truncate max-w-xs md:max-w-md">
                             {log.asset ? <span className="text-gray-200 font-medium">{log.asset.originalName}</span> : log.details}
                           </span>
                           {renderActionLink(log)}
                        </div>
                     </td>
                   </tr>
                 ))}
                 {filteredLogs.length === 0 && (
                   <tr>
                     <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                       No logs found matching your criteria.
                     </td>
                   </tr>
                 )}
               </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* =========================================================
          FULL ROSTER MODAL
          ========================================================= */}
      <AnimatePresence>
        {showRosterModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col h-[85vh] overflow-hidden relative"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#0A0A0A] shrink-0">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    {selectedUser && (
                        <button 
                            onClick={() => setSelectedUser(null)} 
                            className="mr-2 p-1 bg-white/5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    {selectedUser ? `${selectedUser.name}'s Activity` : 'Full Personnel Roster'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1 ml-10">
                    {selectedUser ? 'Complete audit trail for this user.' : 'Complete overview of system adoption and penalties.'}
                  </p>
                </div>
                <button onClick={closeRosterModal} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-hidden relative bg-[#0A0A0A]">
                  <AnimatePresence mode="wait">
                      {!selectedUser ? (
                          <motion.div 
                            key="roster-view"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 p-6 overflow-y-auto custom-scrollbar"
                          >
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                               
                                {/* TIER 1: FREQUENT */}
                                <div>
                                   <h3 className="text-sm font-semibold text-white border-b border-white/10 pb-3 mb-4 flex items-center justify-between">
                                     <div className="flex items-center gap-2"><Zap size={14} className="text-emerald-500" /> Active Users</div>
                                     <span className="bg-white/5 text-gray-400 px-2 py-0.5 rounded text-xs">{frequentUsers.length}</span>
                                   </h3>
                                   <div className="space-y-2">
                                      {frequentUsers.map((u, i) => (
                                         <div 
                                            key={u.id} 
                                            onClick={() => setSelectedUser(u)}
                                            className="flex items-center justify-between p-3 bg-[#121212] border border-white/5 rounded-lg hover:border-white/10 hover:bg-white/[0.02] cursor-pointer transition-colors"
                                         >
                                            <div className="flex items-center gap-3">
                                               <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-medium text-gray-300 overflow-hidden shrink-0">
                                                  {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.name.charAt(0)}
                                               </div>
                                               <div>
                                                 <div className="text-sm font-medium text-gray-200 truncate max-w-[120px]">{u.name}</div>
                                                 <div className="text-xs text-gray-500">{u.lastActive ? formatDistanceToNow(new Date(u.lastActive), { addSuffix: true }) : 'Never'}</div>
                                               </div>
                                            </div>
                                         </div>
                                      ))}
                                   </div>
                                </div>

                                {/* TIER 2: AT RISK */}
                                <div>
                                   <h3 className="text-sm font-semibold text-white border-b border-white/10 pb-3 mb-4 flex items-center justify-between">
                                     <div className="flex items-center gap-2"><AlertTriangle size={14} className="text-orange-500" /> At Risk (30d+)</div>
                                     <span className="bg-white/5 text-gray-400 px-2 py-0.5 rounded text-xs">{atRiskUsers.length}</span>
                                   </h3>
                                   <div className="space-y-2">
                                      {atRiskUsers.map(u => {
                                        const engagement = getUserEngagement(u);
                                        return (
                                         <div 
                                            key={u.id} 
                                            onClick={() => setSelectedUser(u)}
                                            className="flex items-center justify-between p-3 bg-[#121212] border border-orange-500/20 rounded-lg hover:border-orange-500/40 cursor-pointer transition-colors"
                                         >
                                            <div className="flex items-center gap-3">
                                               <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-medium text-gray-300 overflow-hidden shrink-0 grayscale opacity-80">
                                                  {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.name.charAt(0)}
                                               </div>
                                               <div>
                                                 <div className="text-sm font-medium text-gray-200 truncate max-w-[120px]">{u.name}</div>
                                                 <div className="text-xs text-orange-400/80 font-medium">{engagement.daysSince} days inactive</div>
                                               </div>
                                            </div>
                                         </div>
                                        )
                                      })}
                                   </div>
                                </div>

                                {/* TIER 3: GHOSTS */}
                                <div>
                                   <h3 className="text-sm font-semibold text-white border-b border-white/10 pb-3 mb-4 flex items-center justify-between">
                                     <div className="flex items-center gap-2"><Moon size={14} className="text-red-500" /> Ghosts (60d+)</div>
                                     <span className="bg-white/5 text-gray-400 px-2 py-0.5 rounded text-xs">{ghostUsers.length}</span>
                                   </h3>
                                   <div className="space-y-2">
                                      {ghostUsers.map(u => {
                                        const engagement = getUserEngagement(u);
                                        return (
                                         <div 
                                            key={u.id} 
                                            onClick={() => setSelectedUser(u)}
                                            className="flex items-center justify-between p-3 bg-[#121212] border border-red-500/20 rounded-lg hover:border-red-500/40 cursor-pointer transition-colors"
                                         >
                                            <div className="flex items-center gap-3">
                                               <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-medium text-gray-300 overflow-hidden shrink-0 grayscale opacity-50">
                                                  {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.name.charAt(0)}
                                               </div>
                                               <div>
                                                 <div className="text-sm font-medium text-gray-200 truncate max-w-[120px]">{u.name}</div>
                                                 <div className="text-xs text-red-400/80 font-medium">{!u.lastActive ? 'Never Logged In' : `${engagement.daysSince} days inactive`}</div>
                                               </div>
                                            </div>
                                         </div>
                                        )
                                      })}
                                   </div>
                                </div>

                             </div>
                          </motion.div>
                      ) : (
                          <motion.div 
                            key="user-detail"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 p-6 flex flex-col"
                          >
                             <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#121212] rounded-xl border border-white/5">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                  <thead>
                                     <tr className="text-gray-500 border-b border-white/5 sticky top-0 bg-[#171717] z-10 shadow-sm">
                                       <th className="font-medium px-6 py-4 w-40">Timestamp</th>
                                       <th className="font-medium px-6 py-4 w-32">Action</th>
                                       <th className="font-medium px-6 py-4">Target / Details</th>
                                     </tr>
                                  </thead>
                                  <tbody>
                                    {isLoadingLogs ? (
                                        <tr>
                                          <td colSpan={3} className="text-center py-12 text-gray-500">
                                            <Activity className="animate-spin mx-auto mb-2" size={20} />
                                            Loading Activity...
                                          </td>
                                        </tr>
                                    ) : userLogs?.length === 0 ? (
                                        <tr>
                                          <td colSpan={3} className="text-center py-12 text-gray-500">
                                            No activity recorded for this user.
                                          </td>
                                        </tr>
                                    ) : (
                                        userLogs?.map(log => (
                                          <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-3 text-gray-500">
                                              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                            </td>
                                            <td className="px-6 py-3">
                                              <span className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${getBadgeStyle(log.action)}`}>
                                                {log.action.replace('_', ' ')}
                                              </span>
                                            </td>
                                            <td className="px-6 py-3 text-gray-300">
                                              <div className="flex items-center justify-between gap-4 w-full">
                                                  <span className="truncate max-w-sm">
                                                    {log.asset ? <span className="text-white font-medium">{log.asset.originalName}</span> : log.details}
                                                  </span>
                                                  {renderActionLink(log)}
                                              </div>
                                            </td>
                                          </tr>
                                        ))
                                    )}
                                  </tbody>
                                </table>
                             </div>
                          </motion.div>
                      )}
                  </AnimatePresence>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default AdminAnalytics;