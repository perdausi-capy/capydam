import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { motion, type Variants } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, X, Search, ArrowLeft } from 'lucide-react';

// --- TYPES TO MATCH OUR BACKEND ---
interface AnalyticsData {
  storage: { totalBytes: number; totalAssets: number };
  breakdown: { images: number; videos: number; audio: number; docs: number; others: number };
  users: { total: number; admins: number; editors: number; viewers: number };
  visits: { total: number };
  recentUserLogs: Array<{ id: string; action: string; details: string; createdAt: string; user: { name: string; email: string; avatar: string }; asset?: { originalName: string } }>;
  topUploaders: Array<{ id: string; name: string; avatar: string; _count: { assets: number } }>;
  recentActivity: Array<{ id: string; originalName: string; size: number; createdAt: string; uploadedBy: { name: string } }>;
  allUsers: Array<{ id: string; name: string; email: string; avatar: string; role: string; uploads: number; createdDaysAgo: number; lastActive: string | null }>;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getActionColor = (action: string) => {
  switch (action?.toUpperCase()) {
      case 'DOWNLOAD': return 'text-[#4f88ff] bg-[#4f88ff]/10'; 
      case 'UPLOAD': return 'text-[#2ecfa3] bg-[#2ecfa3]/10'; 
      case 'VIEW_ASSET': return 'text-[#7c5cf6] bg-[#7c5cf6]/10'; 
      case 'LOGIN': return 'text-[#8590a8] bg-[#8590a8]/10'; 
      default: return 'text-[#f5a623] bg-[#f5a623]/10'; 
  }
};

// --- SMART ATTENTION ENGINE ---
const computeRisk = (u: any) => {
  const daysSince = !u.lastActive ? u.createdDaysAgo : differenceInDays(new Date(), new Date(u.lastActive));
  const privWeight = u.role.toUpperCase() === 'ADMIN' ? 5 : u.role.toUpperCase() === 'EDITOR' ? 3 : 1;
  
  const inactScore = Math.min(daysSince * 0.5, 60);
  const privScore = privWeight * 2;
  const total = Math.round(inactScore + privScore);
  
  const isGhost = !u.lastActive && u.createdDaysAgo > 14;
  const isStaleAdmin = privWeight >= 5 && daysSince >= 60;
  
  if (!isGhost && !isStaleAdmin && total < 40) return null;
  
  let tier = total >= 80 || isGhost ? 'CRITICAL' : isStaleAdmin || total >= 60 ? 'WARNING' : 'WATCH';
  const reasons = [];
  
  if (isGhost) reasons.push({ label: 'Ghost user', bg: 'bg-[#ef5656]/10', text: 'text-[#ef5656]' });
  if (isStaleAdmin) reasons.push({ label: `${daysSince}d inactive admin`, bg: 'bg-[#f5a623]/10', text: 'text-[#f5a623]' });
  if (u.uploads === 0) reasons.push({ label: '0 uploads', bg: 'bg-[#8590a8]/10', text: 'text-[#8590a8]' });
  
  return { score: total, tier, reasons, daysSince };
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
  // Modal & Deep Dive State
  const [showDirectory, setShowDirectory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const res = await client.get('/analytics');
      return res.data;
    },
    refetchInterval: 15000 
  });

  // Action: Click a user to see deep-dive history
  const handleUserClick = async (user: any) => {
    setSelectedUser(user);
    setShowDirectory(true);
    setLoadingLogs(true);
    try {
      const res = await client.get(`/analytics/user/${user.id}`);
      setUserLogs(res.data);
    } catch (error) {
      console.error("Failed to fetch user logs", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Action: Open general directory
  const openDirectory = () => {
    setSelectedUser(null);
    setShowDirectory(true);
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
  const activeUsers = data.allUsers.filter(u => u.lastActive && differenceInDays(new Date(), new Date(u.lastActive)) <= 1).slice(0, 10);
  const storagePct = data.storage.totalBytes > 0 ? Math.min(100, (data.storage.totalBytes / (500 * 1024 * 1024 * 1024)) * 100).toFixed(0) : 0; 

  const chartData = [
    { name: 'Mon', uploads: 12, downloads: 45 }, { name: 'Tue', uploads: 19, downloads: 60 },
    { name: 'Wed', uploads: 15, downloads: 35 }, { name: 'Thu', uploads: 22, downloads: 80 },
    { name: 'Fri', uploads: 30, downloads: 90 }, { name: 'Sat', uploads: 8, downloads: 20 },
    { name: 'Sun', uploads: 5, downloads: 15 },
  ];

  return (
    <div className="min-h-screen bg-[#07090e] text-[#dde2ed] font-sans pb-24 relative selection:bg-[#4f88ff]/30" 
         style={{ backgroundImage: 'radial-gradient(rgba(79,136,255,0.025) 1px, transparent 1px)', backgroundSize: '28px 28px' }}>
      
      {/* TOP NAV BAR */}
      <div className="sticky top-0 z-50 h-16 flex items-center justify-between px-8 bg-[#07090e]/90 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c5cf6] to-[#4f88ff] flex items-center justify-center font-bold text-white text-lg shadow-lg">C</div>
          <span className="font-semibold text-lg tracking-tight">CapyDAM</span>
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

        {/* 3. AUDIT TRAIL & ACTIVE PERSONNEL */}
        <motion.section variants={itemVariants}>
          <div className="flex items-center gap-4 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#f5a623]/10 text-[#f5a623] flex items-center justify-center text-lg">🔐</div>
              <div><h2 className="text-lg font-semibold">Live audit & security</h2><p className="text-sm text-[#8590a8]">Real-time activity feed</p></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-2 bg-[#0d1018] border border-white/5 rounded-2xl p-7 h-[420px] flex flex-col">
               <p className="font-mono text-xs uppercase tracking-widest text-[#4e5670] mb-5">Recent Activity (Last 50)</p>
               <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar space-y-4">
                 {data.recentUserLogs.map(log => (
                    <div key={log.id} className="flex gap-4 pb-4 border-b border-white/5 last:border-0">
                      <div className="w-10 h-10 rounded-xl bg-[#192030] flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition" onClick={() => handleUserClick(log.user)}>
                        {log.user.avatar ? <img src={log.user.avatar} alt="" className="w-full h-full object-cover"/> : log.user.name.charAt(0)}
                      </div>
                      <div className="pt-0.5">
                        <p className="text-sm text-[#dde2ed]">
                          <span className="font-semibold cursor-pointer hover:text-[#4f88ff] transition" onClick={() => handleUserClick(log.user)}>{log.user.name}</span> <span className="text-[#8590a8] lowercase">{log.action.replace('_', ' ')}</span>
                          {log.asset && <span className={`ml-2 font-mono text-[11px] px-2 py-1 rounded-md ${getActionColor(log.action)}`}>{log.asset.originalName}</span>}
                        </p>
                        <p className="font-mono text-xs text-[#4e5670] mt-1">{formatDistanceToNow(new Date(log.createdAt))} ago</p>
                      </div>
                    </div>
                 ))}
               </div>
               <button onClick={openDirectory} className="mt-5 w-full py-3 bg-[#4f88ff]/10 text-[#4f88ff] border border-[#4f88ff]/20 rounded-xl text-sm font-semibold hover:bg-[#4f88ff]/20 transition">
                  👤 Open full user directory
               </button>
            </div>

            <div className="bg-[#0d1018] border border-white/5 rounded-2xl p-7 h-[420px] overflow-hidden flex flex-col">
              <p className="font-mono text-xs uppercase tracking-widest text-[#4e5670] mb-5">Active Personnel Radar</p>
              <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar space-y-3">
                {activeUsers.length === 0 ? <p className="text-sm text-[#4e5670] text-center mt-10">No users active recently.</p> : activeUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-4 p-3 bg-[#131722] border border-white/5 rounded-xl hover:bg-[#192030] hover:border-white/10 transition cursor-pointer group" onClick={() => handleUserClick(u)}>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-[#192030] flex items-center justify-center font-bold text-sm overflow-hidden">
                         {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover"/> : u.name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#2ecfa3] border-[3px] border-[#131722]"></div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold group-hover:text-[#4f88ff] transition">{u.name}</p>
                      <p className="font-mono text-xs text-[#8590a8] mt-0.5">{u.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* 4. SMART NEEDS ATTENTION ENGINE */}
        <motion.section variants={itemVariants}>
          <div className="flex items-center gap-4 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#ef5656]/10 text-[#ef5656] flex items-center justify-center text-lg">🚨</div>
              <div><h2 className="text-lg font-semibold">Smart needs attention engine</h2><p className="text-sm text-[#8590a8]">Composite health score — real risks only</p></div>
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
                 ✓ {data.allUsers.length - flaggedUsers.length} users are perfectly healthy
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

      {/* ================= SUPER WIDE MODAL ================= */}
      {showDirectory && (
        <div className="fixed inset-0 z-[100] bg-[#05070c]/90 backdrop-blur-md flex justify-center items-start pt-16 pb-16 overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.98, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-[1000px] bg-[#0d1018] border border-white/10 rounded-3xl overflow-hidden mx-4 shadow-2xl">
             
             <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#07090e]/50">
                <div className="flex items-center gap-4">
                  {selectedUser && (
                    <button onClick={() => setSelectedUser(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#131722] hover:bg-[#4f88ff]/20 hover:text-[#4f88ff] transition text-[#8590a8]">
                      <ArrowLeft size={18}/>
                    </button>
                  )}
                  <div>
                    <h2 className="text-xl font-semibold">{selectedUser ? `${selectedUser.name} — Deep Dive` : '👤 Workspace Directory'}</h2>
                    <p className="text-sm text-[#8590a8] mt-1">{selectedUser ? 'Complete lifetime activity history' : 'Search and view details for any platform member'}</p>
                  </div>
                </div>
                <button onClick={() => setShowDirectory(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#131722] border border-white/5 text-[#8590a8] hover:bg-[#ef5656]/20 hover:text-[#ef5656] hover:border-[#ef5656]/30 transition"><X size={20}/></button>
             </div>

             {/* VIEW 1: GRID DIRECTORY */}
             {!selectedUser ? (
               <>
                 <div className="p-6 border-b border-white/5 bg-[#131722]/50">
                   <div className="relative">
                     <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#4e5670]" size={18}/>
                     <input type="text" placeholder="Search users by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-[#192030] border border-white/5 rounded-2xl py-3.5 pl-14 pr-5 text-sm text-white placeholder-[#4e5670] outline-none focus:border-[#4f88ff]/50 transition"/>
                   </div>
                 </div>
                 <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {data.allUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                      <div key={u.id} className="p-5 bg-[#131722] border border-white/5 rounded-2xl hover:border-[#4f88ff]/40 hover:bg-[#192030] cursor-pointer transition group" onClick={() => handleUserClick(u)}>
                         <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-[#192030] flex items-center justify-center font-bold text-sm overflow-hidden border border-white/5">
                              {u.avatar ? <img src={u.avatar} alt=""/> : u.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-[15px] font-semibold group-hover:text-[#4f88ff] transition">{u.name}</p>
                              <p className="font-mono text-xs text-[#8590a8] mt-0.5">{u.role}</p>
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                           <div className="bg-[#0d1018] border border-white/5 rounded-xl p-3 text-center">
                             <div className="font-mono text-sm text-white">{u.uploads}</div>
                             <div className="font-mono text-[10px] uppercase tracking-wider text-[#4e5670] mt-1">uploads</div>
                           </div>
                           <div className="bg-[#0d1018] border border-white/5 rounded-xl p-3 text-center">
                             <div className="font-mono text-sm text-white">{u.lastActive ? formatDistanceToNow(new Date(u.lastActive)) : 'Never'}</div>
                             <div className="font-mono text-[10px] uppercase tracking-wider text-[#4e5670] mt-1">last seen</div>
                           </div>
                         </div>
                      </div>
                    ))}
                 </div>
               </>
             ) : (
               /* VIEW 2: INDIVIDUAL DEEP DIVE */
               <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-[#0d1018]">
                  <div className="flex items-center gap-6 mb-8 p-6 bg-[#131722] border border-white/5 rounded-2xl">
                     <div className="w-20 h-20 rounded-2xl bg-[#192030] flex items-center justify-center font-bold text-2xl overflow-hidden border border-white/10 shadow-lg">
                        {selectedUser.avatar ? <img src={selectedUser.avatar} alt=""/> : selectedUser.name.charAt(0)}
                     </div>
                     <div>
                       <h3 className="text-2xl font-bold">{selectedUser.name}</h3>
                       <p className="font-mono text-sm text-[#8590a8] mt-1">{selectedUser.email} • {selectedUser.role}</p>
                     </div>
                  </div>

                  <h4 className="font-mono text-xs uppercase tracking-widest text-[#4e5670] mb-5">Action Timeline</h4>
                  {loadingLogs ? (
                    <div className="py-20 flex justify-center"><Activity className="text-[#4f88ff] animate-pulse" size={32}/></div>
                  ) : userLogs.length === 0 ? (
                    <div className="py-20 text-center text-[#4e5670] text-sm">No activity recorded for this user.</div>
                  ) : (
                    <div className="space-y-4">
                      {userLogs.map(log => (
                        <div key={log.id} className="flex gap-6 p-5 bg-[#131722] border border-white/5 rounded-xl">
                          <div className="w-28 shrink-0 text-right">
                             <div className="font-mono text-xs text-white">{new Date(log.createdAt).toLocaleDateString()}</div>
                             <div className="font-mono text-[11px] text-[#4e5670] mt-1">{new Date(log.createdAt).toLocaleTimeString()}</div>
                          </div>
                          <div className="w-[1px] bg-white/10 relative">
                             <div className="absolute top-1 -left-1 w-2 h-2 rounded-full bg-[#4f88ff]"></div>
                          </div>
                          <div className="flex-1">
                             <span className={`inline-block font-mono text-[11px] font-bold px-2 py-1 rounded-md mb-2 ${getActionColor(log.action)}`}>
                               {log.action.replace('_', ' ')}
                             </span>
                             {log.details && <p className="text-sm text-[#dde2ed] mb-2">{log.details}</p>}
                             {log.asset && (
                               <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0d1018] border border-white/5 rounded-lg mt-1">
                                 <span className="text-lg">📄</span>
                                 <span className="font-mono text-xs text-[#8590a8] truncate max-w-[300px]">{log.asset.originalName}</span>
                               </div>
                             )}
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