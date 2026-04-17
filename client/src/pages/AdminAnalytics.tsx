import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { differenceInDays } from 'date-fns';
import { motion, type Variants } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, X, ArrowLeft, Filter, ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; 

// --- TYPES TO MATCH OUR BACKEND ---
interface AnalyticsData {
  storage: { totalBytes: number; totalAssets: number };
  breakdown: { images: number; videos: number; audio: number; docs: number; others: number };
  users: { total: number; admins: number; editors: number; viewers: number };
  visits: { total: number };
  recentUserLogs: Array<{ id: string; action: string; details: string; createdAt: string; user: { name: string; email: string; avatar: string }; assetId?: string; asset?: { originalName: string } }>;
  topUploaders: Array<{ id: string; name: string; avatar: string; _count: { assets: number } }>;
  recentActivity: Array<{ id: string; originalName: string; size: number; createdAt: string; uploadedBy: { name: string } }>;
  allUsers: Array<{ id: string; name: string; email: string; avatar: string; role: string; uploads: number; createdDaysAgo: number; lastActive: string | null }>;
  velocityChart: Array<{ name: string; uploads: number; downloads: number }>;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// ✅ UPGRADED: Fuzzy matching catches ANY variation of actions from the backend
const getActionColor = (action: string) => {
  const act = action?.toUpperCase() || '';
  if (act.includes('DOWNLOAD')) return 'text-[#4f88ff] bg-[#4f88ff]/10'; 
  if (act.includes('UPLOAD')) return 'text-[#2ecfa3] bg-[#2ecfa3]/10'; 
  if (act.includes('VIEW')) return 'text-[#7c5cf6] bg-[#7c5cf6]/10'; 
  if (act.includes('DELETE')) return 'text-[#ef5656] bg-[#ef5656]/10';
  if (act.includes('EDIT') || act.includes('UPDATE') || act.includes('RENAME') || act.includes('MODIFY')) return 'text-[#f5a623] bg-[#f5a623]/10'; 
  if (act.includes('LOGIN')) return 'text-[#8590a8] bg-[#8590a8]/10'; 
  return 'text-[#8590a8] bg-[#8590a8]/10'; // Default
};

// --- SMART ATTENTION ENGINE ---
const computeRisk = (u: any) => {
  const daysSince = !u.lastActive ? u.createdDaysAgo : differenceInDays(new Date(), new Date(u.lastActive));
  
  if (daysSince < 30) return null; 
  
  const tier = daysSince >= 60 ? 'CRITICAL' : 'WARNING';
  const reasons = [];
  
  reasons.push({ 
    label: `${daysSince} days inactive`, 
    bg: tier === 'CRITICAL' ? 'bg-[#ef5656]/10' : 'bg-[#f5a623]/10', 
    text: tier === 'CRITICAL' ? 'text-[#ef5656]' : 'text-[#f5a623]' 
  });
  
  if (u.uploads === 0) {
    reasons.push({ label: '0 uploads', bg: 'bg-[#8590a8]/10', text: 'text-[#8590a8]' });
  }
  
  return { score: Math.min(daysSince, 99), tier, reasons, daysSince };
};

// --- FRAMER MOTION VARIANTS ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const AdminAnalytics = () => {
  const navigate = useNavigate(); 
  const [showActiveModal, setShowActiveModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const res = await client.get('/analytics');
      return res.data;
    },
    refetchInterval: 15000 
  });

  const handleUserClick = async (user: any) => {
    setSelectedUser(user);
    setShowActiveModal(true);
    setLoadingLogs(true);
    setSortOrder('desc'); 
    setFilterAction('ALL');
    try {
      const res = await client.get(`/analytics/user/${user.id}`);
      setUserLogs(res.data);
    } catch (error) {
      console.error("Failed to fetch user logs", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const openActiveRoster = () => {
    setSelectedUser(null);
    setShowActiveModal(true);
  };

  const closeModal = () => {
    setShowActiveModal(false);
    setSelectedUser(null);
  };

  // ✅ SMART ASSET NAVIGATION
  const handleAssetNavigation = (log: any) => {
    closeModal();
    const act = log.action.toUpperCase();
    if (act.includes('DELETE')) {
      navigate('/admin/recycle-bin');
    } 
    else if (log.assetId) {
      navigate(`/assets/${log.assetId}`);
    }
  };

  if (isLoading || !data) return (
    <div className="min-h-screen bg-[#07090e] flex items-center justify-center">
       <div className="flex flex-col items-center gap-3">
           <Activity size={36} className="text-[#4f88ff] animate-pulse" />
           <p className="text-[#4e5670] font-mono text-sm uppercase tracking-widest">Booting Studio...</p>
       </div>
    </div>
  );

  const flaggedUsers = data.allUsers.map(u => ({ u, risk: computeRisk(u) })).filter(x => x.risk !== null).sort((a, b) => b.risk!.score - a.risk!.score);
  
  // ✅ SMART ACTIVE RADAR: Only shows users who are genuinely active right now (Ignores Baseline)
  const activeUsers = data.allUsers.filter(u => {
    // Find if this user has any REAL organic logs in the recent activity feed
    const hasRealActivity = data.recentUserLogs.some(log => 
      log.user.email === u.email && 
      log.details !== 'System Analytics Initialization (Baseline)'
    );
    return hasRealActivity;
  }).slice(0, 10);

  // ✅ UNCAPPED TERMINAL: Show ALL recent actions, but HIDE the fake baseline script logs
  const liveAuditLogs = data.recentUserLogs.filter(log => {
    const isRecent = (new Date().getTime() - new Date(log.createdAt).getTime()) < (1000 * 60 * 60 * 8);
    const isNotBaseline = log.details !== 'System Analytics Initialization (Baseline)';
    return isRecent && isNotBaseline;
  });

  const storagePct = data.storage.totalBytes > 0 ? Math.min(100, (data.storage.totalBytes / (500 * 1024 * 1024 * 1024)) * 100).toFixed(0) : 0; 

  // ✅ UPGRADED: Fuzzy matching for the dropdown filter as well
  const processedLogs = userLogs
    .filter(log => {
      if (filterAction === 'ALL') return true;
      const act = log.action.toUpperCase();
      if (filterAction === 'EDIT') return act.includes('EDIT') || act.includes('UPDATE') || act.includes('RENAME') || act.includes('MODIFY');
      if (filterAction === 'UPLOAD') return act.includes('UPLOAD');
      if (filterAction === 'DOWNLOAD') return act.includes('DOWNLOAD');
      if (filterAction === 'DELETE') return act.includes('DELETE');
      if (filterAction === 'VIEW_ASSET') return act.includes('VIEW');
      return act === filterAction;
    })
    .sort((a, b) => {
       const dateA = new Date(a.createdAt).getTime();
       const dateB = new Date(b.createdAt).getTime();
       return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const groupedLogsMap = new Map<string, any[]>();
  processedLogs.forEach(log => {
    const dateStr = new Date(log.createdAt).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
    if (!groupedLogsMap.has(dateStr)) groupedLogsMap.set(dateStr, []);
    groupedLogsMap.get(dateStr)!.push(log);
  });
  const groupedEntries = Array.from(groupedLogsMap.entries());

  const chartData = data.velocityChart || [];

  return (
    <div className="min-h-screen bg-[#07090e] text-[#dde2ed] font-sans pb-24 relative selection:bg-[#4f88ff]/30" 
         style={{ backgroundImage: 'radial-gradient(rgba(79,136,255,0.025) 1px, transparent 1px)', backgroundSize: '28px 28px' }}>
      
      {/* TOP NAV BAR */}
      <div className="sticky top-0 z-50 h-16 flex items-center justify-between px-8 bg-[#07090e]/90 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs bg-[#4f88ff]/10 text-[#4f88ff] border border-[#4f88ff]/20 px-2 py-1 rounded-full ml-2">Analytics Studio</span>
        </div>
        <div className="flex items-center gap-3 border border-white/5 rounded-full px-4 py-1.5 bg-[#0d1018]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2ecfa3] animate-pulse shadow-[0_0_8px_rgba(46,207,163,0.6)]"></span>
          <span className="font-mono text-sm text-[#8590a8]">{activeUsers.length} online now</span>
        </div>
      </div>

      <motion.div 
        className="max-w-[1400px] mx-auto p-8 space-y-14"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >

        {/* 1. EXECUTIVE PULSE */}
        <motion.section variants={itemVariants}>
          <div className="flex items-center gap-4 mb-5">
             <div className="w-8 h-8 rounded-lg bg-[#4f88ff]/10 text-[#4f88ff] flex items-center justify-center text-lg">📊</div>
             <div>
               <h2 className="text-lg font-semibold">Executive pulse</h2>
               <p className="text-sm text-[#8590a8]">Real-time platform health — updated live</p>
             </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            <div className="bg-[#0d1018] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#4f88ff] to-[#7c5cf6]"></div>
              <p className="font-mono text-xs uppercase tracking-widest text-[#4e5670] mb-3">Total Storage</p>
              <div className="font-mono text-4xl text-white leading-none mb-4">{formatBytes(data.storage.totalBytes).split(' ')[0]} <span className="text-xl text-[#8590a8]">{formatBytes(data.storage.totalBytes).split(' ')[1]}</span></div>
              <div className="flex items-center gap-5">
                <div className="relative w-20 h-20 shrink-0">
                  <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
                    <circle cx="36" cy="36" r="28" fill="none" stroke="#131722" strokeWidth="8"/>
                    <circle cx="36" cy="36" r="28" fill="none" stroke="#4f88ff" strokeWidth="8" strokeDasharray="175.9" strokeDashoffset={175.9 - (175.9 * Number(storagePct)) / 100} strokeLinecap="round"/>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                    <span className="text-sm font-medium leading-none">{storagePct}%</span>
                    <span className="text-[10px] text-[#4e5670] mt-1">used</span>
                  </div>
                </div>
                <div className="flex-1 font-mono text-sm text-[#8590a8] space-y-1.5">
                  <div className="flex justify-between"><span>Used</span><span className="text-white">{formatBytes(data.storage.totalBytes)}</span></div>
                  <div className="flex justify-between"><span>Quota</span><span className="text-white">500 GB</span></div>
                </div>
              </div>
            </div>

            <div className="bg-[#0d1018] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-[#2ecfa3]"></div>
              <p className="font-mono text-xs uppercase tracking-widest text-[#4e5670] mb-3">Total Assets</p>
              <div className="font-mono text-4xl text-white leading-none mb-4">{data.storage.totalAssets.toLocaleString()}</div>
              <span className="inline-block font-mono text-xs bg-[#2ecfa3]/10 text-[#2ecfa3] px-3 py-1 rounded-full mb-3">↑ System Active</span>
              <p className="text-sm text-[#8590a8]">Across all categories</p>
            </div>

            <div className="bg-[#0d1018] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-[#7c5cf6]"></div>
              <p className="font-mono text-xs uppercase tracking-widest text-[#4e5670] mb-4">User Base — {data.users.total}</p>
              <div className="space-y-3">
                {[
                  { label: 'Admins', count: data.users.admins, color: 'bg-[#ef5656]', text: 'text-[#ef5656]' },
                  { label: 'Editors', count: data.users.editors, color: 'bg-[#f5a623]', text: 'text-[#f5a623]' },
                  { label: 'Viewers', count: data.users.viewers, color: 'bg-[#4f88ff]', text: 'text-[#4f88ff]' }
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="text-sm text-[#8590a8] w-16">{r.label}</span>
                    <div className="flex-1 h-1.5 bg-[#131722] rounded-full overflow-hidden">
                      <div className={`h-full ${r.color}`} style={{ width: `${data.users.total ? (r.count/data.users.total)*100 : 0}%` }}></div>
                    </div>
                    <span className={`font-mono text-xs w-8 text-right ${r.text}`}>{r.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0d1018] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-[#f5a623]"></div>
              <p className="font-mono text-xs uppercase tracking-widest text-[#4e5670] mb-3">Platform Traffic</p>
              <div className="font-mono text-4xl text-white leading-none mb-4">{data.visits.total.toLocaleString()}</div>
              <span className="inline-block font-mono text-xs bg-[#f5a623]/10 text-[#f5a623] px-3 py-1 rounded-full">Lifetime Visits</span>
            </div>
          </div>
        </motion.section>

        {/* 2. ASSET INTELLIGENCE & VELOCITY CHART */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <section>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#7c5cf6]/10 text-[#7c5cf6] flex items-center justify-center text-lg">🗄️</div>
              <div><h2 className="text-lg font-semibold">Asset intelligence</h2><p className="text-sm text-[#8590a8]">Storage composition</p></div>
            </div>
            <div className="bg-[#0d1018] border border-white/5 rounded-2xl p-7">
               <p className="font-mono text-xs uppercase tracking-widest text-[#4e5670] mb-4">Storage Breakdown</p>
               <div className="flex h-4 rounded-full overflow-hidden mb-8 gap-1 bg-[#131722]">
                  <div className="bg-[#7c5cf6]" style={{ width: `${(data.breakdown.videos/data.storage.totalAssets)*100}%` }}></div>
                  <div className="bg-[#4f88ff]" style={{ width: `${(data.breakdown.images/data.storage.totalAssets)*100}%` }}></div>
                  <div className="bg-[#2ecfa3]" style={{ width: `${(data.breakdown.docs/data.storage.totalAssets)*100}%` }}></div>
               </div>
               <div className="space-y-2">
                 {[
                   { n: 'Videos', c: data.breakdown.videos, col: 'bg-[#7c5cf6]', t: 'text-[#7c5cf6]' },
                   { n: 'Images', c: data.breakdown.images, col: 'bg-[#4f88ff]', t: 'text-[#4f88ff]' },
                   { n: 'Documents', c: data.breakdown.docs, col: 'bg-[#2ecfa3]', t: 'text-[#2ecfa3]' },
                 ].map(item => (
                    <div key={item.n} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-sm ${item.col}`}></div>
                        <span className="text-sm font-medium">{item.n}</span>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="w-32 h-1.5 bg-[#131722] rounded-full overflow-hidden"><div className={`h-full ${item.col}`} style={{ width: `${data.storage.totalAssets ? (item.c/data.storage.totalAssets)*100 : 0}%` }}></div></div>
                        <span className="font-mono text-sm text-[#8590a8] w-10 text-right">{item.c}</span>
                        <span className={`font-mono text-sm w-12 text-right ${item.t}`}>{data.storage.totalAssets ? ((item.c/data.storage.totalAssets)*100).toFixed(0) : 0}%</span>
                      </div>
                    </div>
                 ))}
               </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#2ecfa3]/10 text-[#2ecfa3] flex items-center justify-center text-lg">📈</div>
              <div><h2 className="text-lg font-semibold">Platform velocity</h2><p className="text-sm text-[#8590a8]">Upload vs download activity</p></div>
            </div>
            <div className="bg-[#0d1018] border border-white/5 rounded-2xl p-7 h-[340px] flex flex-col">
              <div className="flex gap-3 mb-6">
                <span className="font-mono text-xs bg-[#2ecfa3]/10 text-[#2ecfa3] px-3 py-1.5 rounded-full">Uploads</span>
                <span className="font-mono text-xs bg-[#4f88ff]/10 text-[#4f88ff] px-3 py-1.5 rounded-full">Downloads</span>
              </div>
              <div className="flex-1 w-full text-sm font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2ecfa3" stopOpacity={0.2}/><stop offset="95%" stopColor="#2ecfa3" stopOpacity={0}/></linearGradient>
                      <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4f88ff" stopOpacity={0.2}/><stop offset="95%" stopColor="#4f88ff" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                    <XAxis dataKey="name" stroke="#5a6278" tickLine={false} axisLine={false} />
                    <YAxis stroke="#5a6278" tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#131722', borderColor: '#ffffff1a', color: '#dde2ed', borderRadius: '12px' }} />
                    <Area type="monotone" dataKey="uploads" stroke="#2ecfa3" strokeWidth={3} fillOpacity={1} fill="url(#colorUv)" />
                    <Area type="monotone" dataKey="downloads" stroke="#4f88ff" strokeWidth={3} fillOpacity={1} fill="url(#colorPv)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </motion.div>

        {/* 3. UNIFIED HORIZONTAL TELEMETRY & AUDIT HUD */}
        <motion.section variants={itemVariants} className="w-full py-8 relative z-10">
          
          <style>{`
            @keyframes sweep-right {
              0% { left: -10%; opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { left: 100%; opacity: 0; }
            }
          `}</style>

          {/* THE HOLOGRAPHIC HUD */}
          <div className="w-full flex flex-col relative h-[750px] bg-[#07090e] border border-[#4f88ff]/20 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(79,136,255,0.1)]">
            
            {/* High-Tech Blue Background Grid */}
            <div className="absolute inset-0 z-0 opacity-40 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(79,136,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(79,136,255,0.15) 1px, transparent 1px)', backgroundSize: '60px 60px', backgroundPosition: 'center center' }}></div>
            
            {/* Sweeping Scanner Line */}
            <div className="absolute top-0 bottom-0 w-[300px] bg-gradient-to-r from-transparent via-[#4f88ff]/5 to-[#4f88ff]/20 border-r-2 border-[#4f88ff] shadow-[4px_0_30px_rgba(79,136,255,0.4)] z-0 pointer-events-none" style={{ animation: 'sweep-right 6s linear infinite' }}></div>

            {/* --- TOP ZONE: ACTIVE PERSONNEL --- */}
            <div className="relative w-full h-[400px] shrink-0 z-20 pt-8 px-8 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-2xl font-bold tracking-[0.2em] uppercase text-[#4f88ff] drop-shadow-[0_0_15px_rgba(79,136,255,0.6)]">
                     Active Capybara
                  </h2>
                </div>
                <div className="flex items-center gap-3 bg-[#4f88ff]/10 px-5 py-2.5 rounded-full border border-[#4f88ff]/20 shadow-[0_0_20px_rgba(79,136,255,0.15)]">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4f88ff] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#4f88ff]"></span>
                  </span>
                  <span className="font-mono text-xs text-[#4f88ff] tracking-wider font-bold">LIVE SCAN</span>
                </div>
              </div>

              {/* ✅ INTERACTIVE MAP DOTS */}
              <div className="absolute inset-0 top-24 bottom-24 z-10 pointer-events-none">
                {activeUsers.length === 0 ? (
                   <div className="absolute inset-0 flex items-center justify-center font-mono text-sm text-[#4e5670]">No active signals detected.</div>
                ) : activeUsers.map((u, i) => {
                   const x = 5 + (i / activeUsers.length) * 90; 
                   const y = 10 + (i % 3) * 35; 

                   return (
                      <div key={u.id} 
                           onClick={() => handleUserClick(u)}
                           className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full overflow-visible flex items-center justify-center opacity-80 cursor-pointer pointer-events-auto hover:scale-125 hover:z-50 transition-all group"
                           style={{ top: `${y}%`, left: `${x}%` }}>
                         <div className="absolute inset-0 rounded-full bg-[#4f88ff]/30 animate-ping" style={{ animationDelay: `${i * 0.2}s` }}></div>
                         <div className="w-[85%] h-[85%] rounded-full overflow-hidden bg-[#0d1018] border border-[#4f88ff]/40 shadow-[0_0_15px_rgba(79,136,255,0.4)] group-hover:border-[#4f88ff]">
                            {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" /> : <div className="w-full h-full flex items-center justify-center text-lg font-bold text-[#4f88ff]">{u.name.charAt(0)}</div>}
                         </div>
                         
                         {/* Hover Tooltip */}
                         <div className="absolute top-[130%] left-1/2 -translate-x-1/2 bg-[#07090e]/90 backdrop-blur-xl border border-[#4f88ff]/30 shadow-[0_0_30px_rgba(79,136,255,0.4)] text-[#4f88ff] px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all w-max z-50">
                            <p className="font-bold text-sm tracking-widest text-white">{u.name}</p>
                            <p className="font-mono text-[10px] uppercase tracking-widest opacity-70 mt-1">{u.role} • Active</p>
                         </div>
                      </div>
                   );
                })}
              </div>

              {/* View Active Roster Button */}
              <div className="mt-auto relative z-30 pb-4 flex justify-center">
                <button onClick={openActiveRoster} className="px-8 py-3 bg-[#4f88ff]/10 text-[#4f88ff] border border-[#4f88ff]/40 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#4f88ff]/20 hover:scale-105 transition-all shadow-[0_0_20px_rgba(79,136,255,0.2)] pointer-events-auto">
                  View All
                </button>
              </div>

            </div>

            {/* --- DIVIDER LINE --- */}
            <div className="relative w-full h-[1px] shrink-0 bg-[#4f88ff]/20 border-b border-dashed border-[#4f88ff]/30 z-20">
            </div>

            {/* --- BOTTOM ZONE: LIVE COMMAND LINE TERMINAL --- */}
            <div className="relative flex-1 flex flex-col z-20 bg-gradient-to-t from-[#4f88ff]/[0.05] to-[#07090e] p-8 overflow-hidden font-mono">
               <div className="shrink-0 flex items-center justify-between mb-4">
                 <h3 className="font-mono text-xs uppercase tracking-widest text-[#4f88ff] flex items-center gap-2">
                   <span className="w-2 h-2 bg-[#4f88ff] rounded-sm animate-pulse shadow-[0_0_8px_#4f88ff]"></span>
                   Live Actions
                 </h3>
               </div>
               
               {/* Hacker Terminal UI (Strictly Static/Unclickable) */}
               <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-4 text-xs">
                 {liveAuditLogs.length === 0 ? (
                   <p className="text-[#4f88ff]/50 animate-pulse mt-2">Waiting for incoming telemetry...</p>
                 ) : (
                   liveAuditLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-3 py-1.5 px-3 rounded border border-transparent transition cursor-default">
                        <span className="text-[#4f88ff]/60 shrink-0">[{new Date(log.createdAt).toLocaleTimeString([], { hour12: false })}]</span>
                        <span className="text-[#2ecfa3] font-bold shrink-0">{log.user.name.split(' ')[0]}@capydam:~$</span>
                        <div className="flex flex-wrap gap-x-2 text-[#dde2ed]">
                          <span className="text-[#f5a623] lowercase">./{log.action.replace('_', '-')}</span>
                          {log.details && <span className="text-[#8590a8]">--msg="{log.details}"</span>}
                          {log.asset && <span className="text-[#4f88ff]">--asset={log.asset.originalName}</span>}
                        </div>
                      </div>
                   ))
                 )}
               </div>
            </div>

          </div>
        </motion.section>

        {/* 4. SMART NEEDS ATTENTION ENGINE */}
        <motion.section variants={itemVariants}>
          <div className="flex items-center gap-4 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#ef5656]/10 text-[#ef5656] flex items-center justify-center text-lg">🚨</div>
              <div><h2 className="text-lg font-semibold">Needs Attention</h2><p className="text-sm text-[#8590a8]">Users who rarely use DAM</p></div>
          </div>
          <div className="bg-[#0d1018] border border-white/5 rounded-2xl p-7">
            <div className="flex gap-3 mb-8 flex-wrap">
               <div className="px-4 py-2 bg-[#ef5656]/10 border border-[#ef5656]/20 rounded-xl flex items-center gap-3">
                 <span className="font-mono text-2xl font-semibold text-[#ef5656]">{flaggedUsers.filter(f => f.risk?.tier === 'CRITICAL').length}</span><span className="text-sm text-[#8590a8]">Critical</span>
               </div>
               <div className="px-4 py-2 bg-[#f5a623]/10 border border-[#f5a623]/20 rounded-xl flex items-center gap-3">
                 <span className="font-mono text-2xl font-semibold text-[#f5a623]">{flaggedUsers.filter(f => f.risk?.tier === 'WARNING').length}</span><span className="text-sm text-[#8590a8]">Warning</span>
               </div>
               <div className="ml-auto px-4 py-2 bg-[#2ecfa3]/10 border border-[#2ecfa3]/20 rounded-xl flex items-center text-sm text-[#2ecfa3]">
                 ✓ {data.allUsers.length - flaggedUsers.length} active users
               </div>
            </div>
            <div className="space-y-3">
              {flaggedUsers.length === 0 ? <p className="text-center text-[#4e5670] py-10 text-sm">System health is optimal. No flags raised.</p> : 
               flaggedUsers.slice(0, 10).map(({ u, risk }) => (
                <div key={u.id} className="flex items-center gap-5 p-4 bg-[#131722] border border-white/5 rounded-xl cursor-pointer hover:bg-[#192030] transition" onClick={() => handleUserClick(u)}>
                   <div className="w-12 h-12 rounded-xl bg-[#192030] flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden grayscale">
                      {u.avatar ? <img src={u.avatar} alt=""/> : u.name.charAt(0)}
                   </div>
                   <div className="flex-1">
                     <p className="text-base font-semibold">{u.name} <span className="font-mono text-xs text-[#8590a8] ml-2">{u.role}</span></p>
                     <div className="flex gap-2 mt-2">
                       {risk?.reasons.map((r, i) => <span key={i} className={`font-mono text-[11px] px-2.5 py-1 rounded-md ${r.bg} ${r.text}`}>{r.label}</span>)}
                     </div>
                   </div>
                   <div className="text-right shrink-0">
                     <div className={`font-mono text-3xl font-semibold ${risk?.tier === 'CRITICAL' ? 'text-[#ef5656]' : 'text-[#f5a623]'}`}>{risk?.score}</div>
                     <div className={`font-mono text-xs uppercase mt-1 ${risk?.tier === 'CRITICAL' ? 'text-[#ef5656]' : 'text-[#f5a623]'}`}>{risk?.tier}</div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

      </motion.div>

      {/* ================= MODAL: ACTIVE ROSTER & DEEP DIVE ================= */}
      {showActiveModal && (
        <div className="fixed inset-0 z-[100] bg-[#05070c]/90 backdrop-blur-md flex justify-center items-start pt-16 pb-16 overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.98, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-[1000px] bg-[#0d1018] border border-[#4f88ff]/20 rounded-3xl overflow-hidden mx-4 shadow-[0_0_50px_rgba(79,136,255,0.1)]">
             
             {/* Header */}
             <div className="flex items-center justify-between p-6 border-b border-[#4f88ff]/10 bg-[#07090e]/50">
                <div className="flex items-center gap-4">
                  {selectedUser && (
                    <button onClick={() => setSelectedUser(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#131722] border border-[#4f88ff]/20 hover:bg-[#4f88ff]/20 hover:text-[#4f88ff] transition text-[#8590a8]">
                      <ArrowLeft size={18}/>
                    </button>
                  )}
                  <div>
                    <h2 className="text-xl font-semibold text-[#4f88ff] uppercase tracking-widest">{selectedUser ? `${selectedUser.name} — Deep Dive` : 'Active Personnel Roster'}</h2>
                    <p className="font-mono text-xs text-[#8590a8] mt-1">{selectedUser ? 'Complete lifetime activity history' : 'Currently online and active users'}</p>
                  </div>
                </div>
                
                {/* SMART CLOSE BUTTON */}
                <button onClick={selectedUser ? () => setSelectedUser(null) : closeModal} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#131722] border border-white/5 text-[#8590a8] hover:bg-[#ef5656]/20 hover:text-[#ef5656] hover:border-[#ef5656]/30 transition">
                  <X size={20}/>
                </button>
             </div>

             {/* VIEW 1: ACTIVE PERSONNEL GRID */}
             {!selectedUser ? (
               <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar bg-[#0d1018]">
                  {activeUsers.length === 0 ? (
                    <div className="col-span-full py-20 text-center font-mono text-sm text-[#4e5670]">No active personnel found.</div>
                  ) : activeUsers.map(u => (
                    <div key={u.id} className="p-5 bg-[#131722] border border-[#4f88ff]/10 rounded-2xl hover:border-[#4f88ff]/50 hover:bg-[#4f88ff]/5 cursor-pointer transition-all shadow-sm group" onClick={() => handleUserClick(u)}>
                       <div className="flex items-center gap-4 mb-4">
                          <div className="relative w-12 h-12 rounded-xl bg-[#192030] flex items-center justify-center font-bold text-sm overflow-hidden border border-[#4f88ff]/20">
                            <div className="absolute inset-0 border-2 border-[#2ecfa3] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            {u.avatar ? <img src={u.avatar} alt=""/> : <span className="text-[#4f88ff]">{u.name.charAt(0)}</span>}
                          </div>
                          <div>
                            <p className="text-[15px] font-semibold text-white group-hover:text-[#4f88ff] transition">{u.name}</p>
                            <p className="font-mono text-xs text-[#8590a8] mt-0.5">{u.role}</p>
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                         <div className="bg-[#0d1018] border border-white/5 rounded-xl p-3 text-center">
                           <div className="font-mono text-sm text-white">{u.uploads}</div>
                           <div className="font-mono text-[10px] uppercase tracking-wider text-[#4e5670] mt-1">uploads</div>
                         </div>
                         <div className="bg-[#0d1018] border border-white/5 rounded-xl p-3 text-center">
                           <div className="font-mono text-sm text-[#2ecfa3]">Online</div>
                           <div className="font-mono text-[10px] uppercase tracking-wider text-[#4e5670] mt-1">status</div>
                         </div>
                       </div>
                    </div>
                  ))}
               </div>
             ) : (
               /* VIEW 2: INDIVIDUAL DEEP DIVE */
               <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-[#0d1018]">
                  <div className="flex items-center gap-6 mb-6 p-6 bg-[#131722] border border-[#4f88ff]/10 rounded-2xl">
                     <div className="w-20 h-20 rounded-2xl bg-[#192030] flex items-center justify-center font-bold text-2xl overflow-hidden border border-[#4f88ff]/30 shadow-[0_0_20px_rgba(79,136,255,0.2)]">
                        {selectedUser.avatar ? <img src={selectedUser.avatar} alt=""/> : <span className="text-[#4f88ff]">{selectedUser.name.charAt(0)}</span>}
                     </div>
                     <div>
                       <h3 className="text-2xl font-bold text-white">{selectedUser.name}</h3>
                       <p className="font-mono text-sm text-[#8590a8] mt-1">{selectedUser.email} • {selectedUser.role}</p>
                     </div>
                  </div>

                  {/* DATA CONTROLS */}
                  <div className="flex items-center justify-between mb-6 bg-[#131722] p-2.5 rounded-xl border border-[#4f88ff]/10">
                     <div className="flex items-center gap-2">
                       <Filter size={16} className="text-[#8590a8] ml-2" />
                       <select
                         value={filterAction}
                         onChange={e => setFilterAction(e.target.value)}
                         className="bg-transparent text-sm text-white outline-none font-mono py-1 px-2 cursor-pointer appearance-none"
                       >
                         <option value="ALL" className="bg-[#131722]">All Activity</option>
                         <option value="UPLOAD" className="bg-[#131722]">Uploads</option>
                         <option value="DOWNLOAD" className="bg-[#131722]">Downloads</option>
                         <option value="EDIT" className="bg-[#131722]">Edits</option>
                         <option value="VIEW_ASSET" className="bg-[#131722]">Asset Views</option>
                         <option value="DELETE" className="bg-[#131722]">Deletions</option>
                       </select>
                     </div>
                     <button
                       onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                       className="flex items-center gap-2 text-sm font-mono text-white transition px-4 py-1.5 rounded-lg bg-[#4f88ff]/10 border border-[#4f88ff]/20 hover:bg-[#4f88ff]/20"
                     >
                       <ArrowUpDown size={14} className="text-[#4f88ff]" />
                       {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                     </button>
                  </div>
                  
                  {loadingLogs ? (
                    <div className="py-20 flex justify-center"><Activity className="text-[#4f88ff] animate-pulse" size={32}/></div>
                  ) : processedLogs.length === 0 ? (
                    <div className="py-20 text-center text-[#4e5670] text-sm font-mono">No matching activity found.</div>
                  ) : (
                    <div className="space-y-8">
                      {/* GROUP LOGS BY DATE */}
                      {groupedEntries.map(([date, logs]) => (
                        <div key={date}>
                          {/* THE DATE HEADER */}
                          <div className="flex items-center gap-4 mb-4">
                            <span className="font-mono text-sm text-[#4f88ff] font-semibold tracking-wide bg-[#4f88ff]/10 px-3 py-1 rounded-md border border-[#4f88ff]/20">
                              [{date}]
                            </span>
                            <div className="h-[1px] flex-1 bg-gradient-to-r from-[#4f88ff]/30 to-transparent"></div>
                          </div>
                          
                          {/* THE LOGS FOR THIS DATE */}
                          <div className="space-y-3 pl-4">
                            {logs.map(log => {
                              const isDelete = log.action.toUpperCase().includes('DELETE');
                              const isEdit = log.action.toUpperCase().includes('EDIT') || log.action.toUpperCase().includes('UPDATE') || log.action.toUpperCase().includes('RENAME') || log.action.toUpperCase().includes('MODIFY');
                              
                              return (
                                <div key={log.id} className="flex gap-6 p-4 bg-[#131722]/50 hover:bg-[#131722] border border-[#4f88ff]/5 hover:border-[#4f88ff]/20 rounded-xl transition cursor-default">
                                  <div className="w-20 shrink-0 mt-0.5">
                                     <div className="font-mono text-[11px] text-[#8590a8]">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                  </div>
                                  <div className="w-[1px] bg-white/5 relative">
                                     <div className="absolute top-1.5 -left-1 w-2 h-2 rounded-full bg-[#4f88ff]/50"></div>
                                  </div>
                                  <div className="flex-1">
                                     <span className={`inline-block font-mono text-[11px] font-bold px-2 py-1 rounded-md mb-3 ${getActionColor(log.action)}`}>
                                       {log.action.replace('_', ' ')}
                                     </span>
                                     
                                     {log.details && <p className="text-sm text-[#dde2ed] mb-3">{log.details}</p>}
                                     
                                     {/* ✅ SMART TRACKABLE ASSET PORTAL */}
                                     {log.asset && (
                                       <div 
                                         onClick={() => log.assetId ? handleAssetNavigation(log) : null}
                                         className={`inline-flex items-center gap-3 px-4 py-2 bg-[#0d1018] border border-[#4f88ff]/20 rounded-lg shadow-[0_0_10px_rgba(79,136,255,0.05)] ${log.assetId ? 'hover:bg-[#4f88ff]/10 hover:border-[#4f88ff] transition-all cursor-pointer group/asset' : 'opacity-70 cursor-not-allowed'}`}
                                       >
                                         <div className={`w-8 h-8 rounded bg-[#131722] flex items-center justify-center text-lg border border-white/5 ${log.assetId ? 'group-hover/asset:border-[#4f88ff]/30' : ''}`}>
                                           {isDelete ? '🗑️' : isEdit ? '✏️' : '📄'}
                                         </div>
                                         <div>
                                           <span className={`font-mono text-xs text-white block truncate max-w-[250px] ${log.assetId ? 'group-hover/asset:text-[#4f88ff] transition-colors' : ''}`}>{log.asset.originalName}</span>
                                           <span className="font-mono text-[9px] text-[#4f88ff] uppercase tracking-widest opacity-80">
                                              {isDelete ? 'View in Recycle Bin →' : isEdit ? 'Tracked Asset • View Edit →' : 'Tracked Asset • View Details →'}
                                           </span>
                                         </div>
                                       </div>
                                     )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
               </div>
             )}
          </motion.div>
        </div>
      )}

    </div>
  );
};

export default AdminAnalytics;