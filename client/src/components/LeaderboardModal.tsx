import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Trophy, Flame, Medal, Crown, Shield, Star, Timer, Target, 
    Play, Square, AlertOctagon, Gift, Gem, Map, Compass, Eye, Circle, Swords, Info 
} from 'lucide-react';
import client from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal';

// --- TIERS CONFIGURATION ---
const ALL_TIME_TIERS = [
    { name: "IMMORTAL", minScore: 100000, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/50", icon: Crown },
    { name: "MYTHIC", minScore: 50000, color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/50", icon: Gem },
    { name: "LEGEND", minScore: 25000, color: "text-red-500", bg: "bg-red-500/10 border-red-500/50", icon: Star },
    { name: "CHAMPION", minScore: 10000, color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/50", icon: Trophy },
    { name: "WARRIOR", minScore: 5000, color: "text-blue-600", bg: "bg-blue-500/10 border-blue-500/50", icon: Swords },
    { name: "VETERAN", minScore: 2500, color: "text-cyan-500", bg: "bg-cyan-500/10 border-cyan-500/50", icon: Shield },
    { name: "ADVENTURER", minScore: 1000, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/50", icon: Map },
    { name: "RANGER", minScore: 500, color: "text-green-500", bg: "bg-green-500/10 border-green-500/50", icon: Compass },
    { name: "SCOUT", minScore: 100, color: "text-lime-500", bg: "bg-lime-500/10 border-lime-500/50", icon: Eye },
    { name: "NOVICE", minScore: 0, color: "text-gray-400", bg: "bg-gray-100 dark:bg-white/5 border-gray-200", icon: Circle },
];

// --- COUNTDOWN BADGE ---
const SeasonCountdown = ({ isEnded, minimal = false }: { isEnded: boolean, minimal?: boolean }) => {
    const [timeLeft, setTimeLeft] = useState("Loading...");

    useEffect(() => {
        if (isEnded) return;
        const calculateTime = () => {
            const now = new Date();
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            const diff = endOfMonth.getTime() - now.getTime();
            if (diff <= 0) return "LAST DAY";
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            return `${d}d ${h}h`;
        };
        setTimeLeft(calculateTime());
        const timer = setInterval(() => setTimeLeft(calculateTime()), 60000);
        return () => clearInterval(timer);
    }, [isEnded]);

    if (isEnded) {
        return (
            <div className={`flex items-center gap-1.5 bg-red-100 dark:bg-red-900/30 border border-red-500 px-2 py-0.5 md:px-3 md:py-1 rounded text-red-700 dark:text-red-400 font-black text-[10px] uppercase shadow-sm ${minimal ? '' : 'md:text-xs'}`}>
                <Square size={minimal ? 10 : 12} fill="currentColor" />
                <span>ENDED</span>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 border border-green-500 px-2 py-0.5 md:px-3 md:py-1 rounded text-green-700 dark:text-green-400 font-black text-[10px] uppercase shadow-sm ${minimal ? '' : 'md:text-xs'}`}>
            <Timer size={minimal ? 10 : 12} />
            <span className="whitespace-nowrap">{timeLeft}</span>
        </div>
    );
};

// --- TIERS REFERENCE MODAL (OVERLAY) ---
const TiersLegend = ({ onClose }: { onClose: () => void }) => (
    <div className="absolute inset-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm flex flex-col p-4 md:p-6 animate-in fade-in duration-200">
        <div className="flex justify-between items-center mb-4 md:mb-6 border-b-2 border-gray-200 dark:border-slate-800 pb-4">
            <h3 className="text-lg md:text-xl font-black uppercase text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="text-indigo-500" /> Rank Requirements
            </h3>
            <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pb-4">
            {ALL_TIME_TIERS.map((tier) => (
                <div key={tier.name} className={`flex items-center justify-between p-3 rounded-lg border-l-4 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 ${tier.color.replace('text-', 'border-')}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-md ${tier.bg}`}>
                            <tier.icon size={16} className={tier.color} />
                        </div>
                        <span className={`font-black uppercase tracking-wider text-xs ${tier.color}`}>{tier.name}</span>
                    </div>
                    <span className="font-mono font-bold text-xs text-gray-500 dark:text-slate-400">{tier.minScore.toLocaleString()} XP</span>
                </div>
            ))}
        </div>
    </div>
);

const LeaderboardModal = ({ isOpen, onClose }: any) => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [timeframe, setTimeframe] = useState<'monthly' | 'all'>('monthly');
  const [showTiersLegend, setShowTiersLegend] = useState(false);
  
  // Modal States
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmNuke, setConfirmNuke] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', timeframe],
    queryFn: async () => (await client.get(`/daily/leaderboard?range=${timeframe}`)).data,
    enabled: isOpen
  });

  const startSeasonMutation = useMutation({
      mutationFn: async () => client.post('/daily/season/start'),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
          toast.success("🚀 Season STARTED! Good luck!");
          setConfirmStart(false);
      }
  });

  const endSeasonMutation = useMutation({
      mutationFn: async () => client.post('/daily/season/end'),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
          toast.success("🛑 Season ENDED. Winners rewarded.");
          setConfirmEnd(false);
      }
  });

  const resetAllMutation = useMutation({
      mutationFn: async () => client.post('/daily/admin/nuke-all'),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
          queryClient.invalidateQueries({ queryKey: ['quest-stats'] });
          toast.success("☢️ Global Wipe Complete");
          setConfirmNuke(false);
      }
  });

  const leaders = data?.leaders || [];
  const myStats = data?.user;
  const isSeasonEnded = data?.status === 'ENDED';
  const champion = leaders.length > 0 && leaders[0].rank === 1 ? leaders[0] : null;

  // --- 👑 TIER LOGIC ---
  const getTier = (rank: number, score: number, mode: 'monthly' | 'all') => {
      if (mode === 'monthly') {
          if (rank === 0) return { title: "Spectator", color: "text-gray-400 bg-gray-100 dark:bg-white/5", icon: Circle };
          if (rank === 1) return { title: "CURRENT LEADER", color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200", icon: Crown };
          if (rank <= 3) return { title: "PODIUM", color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200", icon: Medal };
          if (rank <= 10) return { title: "TOP 10", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 border-blue-200", icon: Shield };
          return { title: "CONTENDER", color: "text-slate-500 bg-slate-100 dark:bg-slate-800", icon: Star };
      }

      const tierIndex = ALL_TIME_TIERS.findIndex(t => score >= t.minScore);
      const currentTier = ALL_TIME_TIERS[tierIndex !== -1 ? tierIndex : ALL_TIME_TIERS.length - 1];
      const nextTier = tierIndex > 0 ? ALL_TIME_TIERS[tierIndex - 1] : null;

      return { 
          title: currentTier.name, 
          color: currentTier.color,
          bg: currentTier.bg,
          minScore: currentTier.minScore,
          nextTier: nextTier,
          icon: currentTier.icon 
      };
  };

  const getRankStyles = (rank: number) => {
    if (rank === 0) return { bg: "bg-gray-50 dark:bg-slate-900/50", border: "border-gray-100 dark:border-slate-800", icon: <span className="text-xs font-mono opacity-30">-</span> };
    if (rank === 1) return { bg: "bg-yellow-50 dark:bg-yellow-900/20", border: "border-yellow-500", icon: <Crown size={16} className="text-yellow-600 dark:text-yellow-400 md:w-[18px] md:h-[18px]" fill="currentColor"/> };
    if (rank === 2) return { bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-500", icon: <Medal size={16} className="text-orange-600 dark:text-orange-400 md:w-[18px] md:h-[18px]" fill="currentColor"/> };
    if (rank === 3) return { bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-500", icon: <Gem size={16} className="text-purple-600 dark:text-purple-400 md:w-[18px] md:h-[18px]" fill="currentColor"/> };
    if (rank <= 10) return { bg: "bg-white dark:bg-slate-800", border: "border-slate-300 dark:border-slate-600", icon: <Shield size={14} className="text-slate-400 md:w-[16px] md:h-[16px]" fill="currentColor"/> };
    return { bg: "bg-white dark:bg-slate-800", border: "border-gray-200 dark:border-slate-700", icon: <Star size={14} className="text-gray-400 md:w-[16px] md:h-[16px]" /> };
  };

  const UserRow = ({ user, rank, isMe }: any) => {
    const style = getRankStyles(rank);
    const tier = getTier(rank, user.score, timeframe);
    const TierIcon = tier.icon || Circle;

    return (
      <div className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl border-b-4 border-r-2 border-l-2 border-t-2 transition-transform hover:scale-[1.01] relative ${style.bg} ${style.border} ${isMe ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 z-10' : ''}`}>
        
        {/* RANK/TIER ICON */}
        <div className="w-8 md:w-10 flex justify-center items-center font-black text-gray-500 dark:text-slate-400 shrink-0 text-xs md:text-sm">
            {timeframe === 'all' ? (
                <div className={`p-1 md:p-1.5 rounded-lg border ${tier.bg || 'bg-gray-100 border-gray-200'}`}>
                    <TierIcon size={14} className={`md:w-[16px] md:h-[16px] ${tier.color}`} />
                </div>
            ) : (
                rank <= 3 && rank > 0 ? style.icon : (rank === 0 ? '-' : `#${rank}`)
            )}
        </div>

        {/* AVATAR */}
        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg border-2 overflow-hidden bg-gray-200 dark:bg-slate-700 shrink-0 ${style.border}`}>
            {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-500 text-xs md:text-sm">{user.name?.[0]}</div>}
        </div>
        
        {/* CENTER INFO */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2">
                <span className={`text-xs md:text-sm font-black truncate uppercase ${isMe ? 'text-indigo-600 dark:text-indigo-400' : (rank === 0 ? 'text-gray-400' : 'text-gray-900 dark:text-white')}`}>
                    {user.name} {isMe && '(YOU)'}
                </span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 overflow-hidden">
                <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-wider truncate ${tier.color}`}>
                    {tier.title}
                </span>
                {user.streak > 0 && (
                    <span className="text-[8px] md:text-[9px] font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-1 md:px-1.5 rounded flex items-center gap-1 shrink-0">
                        <Flame size={8} fill="currentColor" /> {user.streak}
                    </span>
                )}
            </div>
        </div>
        
        {/* SCORE */}
        <div className="text-right shrink-0">
            <span className={`block text-base md:text-lg font-black leading-none ${rank === 0 ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>{user.score.toLocaleString()}</span>
            <span className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase">XP</span>
        </div>
      </div>
    );
  };

  const getProgressStats = (score: number) => {
      const tierInfo = getTier(1, score, 'all');
      if (!tierInfo.nextTier) return { percent: 100, current: score, max: score, nextTitle: "MAX" };
      
      const prevMin = tierInfo.minScore;
      const nextMin = tierInfo.nextTier.minScore;
      
      const range = nextMin - prevMin;
      const progress = score - prevMin;
      const percent = Math.min(100, Math.max(0, (progress / range) * 100));
      
      return { percent, current: score, max: nextMin, nextTitle: tierInfo.nextTier.name };
  };

  if (!isOpen) return null;

  return (
    <>
    {/* ✅ MODAL CONTAINER: Full screen on mobile, windowed on desktop */}
    <div className="fixed inset-0 z-[1070] flex items-center justify-center md:p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="bg-white dark:bg-slate-900 w-full h-[100dvh] md:h-[85vh] max-w-7xl md:rounded-xl border-0 md:border-4 md:border-gray-900 md:dark:border-slate-500 shadow-none md:shadow-[12px_12px_0px_0px_rgba(0,0,0,0.5)] flex flex-col md:flex-row overflow-hidden relative"
      >
        
        {/* --- LEFT: LADDER --- */}
        <div className="flex-1 flex flex-col border-r-0 md:border-r-4 md:border-gray-900 md:dark:border-slate-500 bg-gray-50 dark:bg-slate-800 relative h-full">
            
            <AnimatePresence>
                {showTiersLegend && <TiersLegend onClose={() => setShowTiersLegend(false)} />}
            </AnimatePresence>

            {/* HEADER */}
            <div className="p-3 md:p-6 border-b-4 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex justify-between items-center shrink-0 pt-safe">
                <div className="flex-1">
                    <div className="flex items-center gap-2 md:gap-3">
                        <h2 className="text-lg md:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tighter">
                            <Trophy className="text-yellow-500" fill="currentColor" size={20} /> 
                            <span className="hidden sm:inline">Hall of Fame</span>
                            <span className="sm:hidden">Rankings</span>
                        </h2>
                        {timeframe === 'monthly' && (
                            <div className="md:hidden">
                                <SeasonCountdown isEnded={isSeasonEnded} minimal={true} />
                            </div>
                        )}
                    </div>
                    <p className="text-[9px] md:text-xs text-gray-500 dark:text-slate-400 font-bold tracking-widest mt-0.5 md:mt-1">
                        {timeframe === 'monthly' ? "SEASON BATTLE" : "LEGENDS ARCHIVE"}
                    </p>
                </div>
                <button onClick={onClose} className="p-2 md:hidden bg-red-500 text-white rounded-lg border-2 border-red-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:translate-y-0.5 active:shadow-none"><X size={18} strokeWidth={3}/></button>
            </div>

            {/* FILTERS & ADMIN BAR (Scrollable horizontally on mobile) */}
            <div className="px-3 py-2 md:px-6 md:py-4 flex items-center gap-3 border-b-4 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-900 shrink-0 overflow-x-auto no-scrollbar">
                <div className="flex gap-2 shrink-0">
                    <button onClick={() => setTimeframe('monthly')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-[10px] md:text-xs font-black uppercase border-2 transition-all shadow-sm active:translate-y-[1px] active:shadow-none ${timeframe === 'monthly' ? 'bg-indigo-500 border-indigo-700 text-white' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-500 hover:bg-gray-50'}`}>Season</button>
                    <button onClick={() => setTimeframe('all')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-[10px] md:text-xs font-black uppercase border-2 transition-all shadow-sm active:translate-y-[1px] active:shadow-none ${timeframe === 'all' ? 'bg-indigo-500 border-indigo-700 text-white' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-500 hover:bg-gray-50'}`}>All Time</button>
                </div>

                {timeframe === 'all' && (
                    <button onClick={() => setShowTiersLegend(true)} className="shrink-0 text-[10px] md:text-xs bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 px-2 py-1.5 md:px-3 md:py-2 rounded border border-gray-300 dark:border-slate-600 font-bold hover:text-indigo-500 flex items-center gap-1 shadow-sm">
                        <Info size={12} /> Tiers
                    </button>
                )}

                {isAdmin && timeframe === 'monthly' && (
                    <div className="flex gap-2 shrink-0 ml-auto">
                        {isSeasonEnded ? (
                            <button onClick={() => setConfirmStart(true)} className="text-[10px] md:text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded border-2 border-green-300 font-bold hover:bg-green-200 flex items-center gap-1 shadow-sm active:translate-y-0.5"><Play size={12} fill="currentColor"/> START</button>
                        ) : (
                            <button onClick={() => setConfirmEnd(true)} className="text-[10px] md:text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded border-2 border-red-300 font-bold hover:bg-red-200 flex items-center gap-1 shadow-sm active:translate-y-0.5"><Square size={12} fill="currentColor"/> END</button>
                        )}
                    </div>
                )}
                {isAdmin && timeframe === 'all' && (
                    <button onClick={() => setConfirmNuke(true)} className="shrink-0 ml-auto text-[10px] md:text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded border-2 border-red-300 font-bold hover:bg-red-200 flex items-center gap-1 animate-pulse"><AlertOctagon size={12}/> NUKE</button>
                )}
            </div>

            {/* LIST AREA */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-4 space-y-2 md:space-y-3">
                {isLoading ? <div className="text-center py-20 font-bold text-gray-400">Loading...</div> : (
                    <>
                        {/* ✅ MOBILE CHAMPION BANNER */}
                        <div className="md:hidden mb-4 rounded-xl bg-gray-900 dark:bg-black border-2 border-yellow-500 p-4 relative overflow-hidden flex items-center gap-4 shadow-[4px_4px_0px_0px_rgba(234,179,8,0.3)]">
                             <Crown size={60} className="absolute -right-4 -top-4 text-yellow-500/20 rotate-12" />
                             
                             <div className="w-14 h-14 rounded-full border-2 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)] overflow-hidden shrink-0 bg-slate-800">
                                  {champion?.avatar ? <img src={champion.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Target size={20} className="text-slate-600"/></div>}
                             </div>
                             
                             <div className="flex-1 min-w-0 z-10">
                                 <div className="text-[9px] font-black text-yellow-400 uppercase tracking-widest mb-0.5">
                                     {timeframe === 'all' ? "LEGEND" : (isSeasonEnded ? "WINNER" : "LEADER")}
                                 </div>
                                 <div className="text-white font-black uppercase text-base truncate leading-tight">
                                     {champion ? champion.name : "VACANT"}
                                 </div>
                                 {champion && (
                                     <div className="text-indigo-400 font-mono text-[10px] font-bold mt-0.5">
                                         {champion.score.toLocaleString()} XP
                                     </div>
                                 )}
                             </div>
                        </div>

                        {/* THE LIST */}
                        {leaders.length > 0 ? leaders.map((user: any) => <UserRow key={user.id} user={user} rank={user.rank} isMe={user.id === currentUser?.id} />) 
                        : <div className="text-center py-10 md:py-20 font-bold text-gray-400 uppercase text-xs md:text-sm">{isSeasonEnded ? "Season Ended" : "No Champions Yet"}</div>}
                    </>
                )}
            </div>
            
            {/* BOTTOM FIXED: MY STATS */}
            {!isLoading && myStats && myStats.rank > 10 && (
                <div className="p-3 md:p-4 bg-indigo-50 dark:bg-indigo-900/20 border-t-4 border-indigo-200 dark:border-indigo-900/50 shrink-0 pb-safe">
                    <UserRow user={myStats} rank={myStats.rank} isMe={true} />
                </div>
            )}
        </div>

        {/* --- RIGHT: THRONE (Desktop Only) --- */}
        <div className="hidden md:flex flex-col w-[420px] bg-gray-100 dark:bg-slate-800 relative">
             <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 bg-red-500 hover:bg-red-400 text-white rounded border-2 border-red-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"><X size={20}/></button>
             
             {/* 1. TOP SECTION: CHAMPION DISPLAY */}
             <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative border-b-4 border-gray-200 dark:border-slate-700">
                 <div className="mb-10 flex flex-col items-center gap-3 relative z-10">
                     <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                        {timeframe === 'all' ? "ALL-TIME LEGEND" : (isSeasonEnded ? "SEASON CHAMPION" : (champion ? "CURRENT LEADER" : "SEASON STATUS"))}
                     </span>
                     {timeframe === 'monthly' && <SeasonCountdown isEnded={isSeasonEnded} />}
                 </div>

                 <div className="relative mb-8">
                    {champion && <Crown size={64} className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 drop-shadow-lg transform -rotate-6 ${isSeasonEnded || timeframe === 'all' ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 dark:text-slate-600 opacity-50'}`} />}
                    
                    <div className={`w-48 h-48 rounded-3xl border-[6px] bg-white dark:bg-slate-700 flex items-center justify-center shadow-xl overflow-hidden relative z-10 ${champion ? 'border-yellow-500' : 'border-gray-300 dark:border-slate-600 border-dashed'}`}>
                         {champion ? <img src={champion.avatar} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center text-gray-300 dark:text-slate-600"><Target size={56} /><span className="text-xs font-black mt-2 uppercase tracking-widest">Vacant</span></div>}
                    </div>
                    
                    {champion && (
                        <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 z-30 text-xs font-black px-5 py-1.5 rounded-full border-2 uppercase tracking-wider shadow-lg whitespace-nowrap bg-white text-gray-800 border-gray-300 dark:bg-slate-800 dark:text-white dark:border-slate-600`}>
                            {getTier(1, champion.score, timeframe).title}
                        </div>
                    )}
                 </div>

                 <div className="mt-2">
                    <h3 className={`text-3xl font-black uppercase leading-tight ${champion ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'}`}>
                        {champion ? champion.name : (isSeasonEnded ? "Wait for Start" : "Vacant Throne")}
                    </h3>
                    <p className="text-base font-bold text-indigo-500 mt-1">
                        {champion ? `${champion.score.toLocaleString()} XP` : "Join the battle"}
                    </p>
                 </div>
             </div>
             
             {/* 2. BOTTOM SECTION */}
             {timeframe === 'monthly' ? (
                 <div className="p-6 bg-white dark:bg-slate-900 h-[220px]">
                    <div className="border-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-4 rounded-xl relative overflow-hidden h-full flex flex-col justify-center">
                        <div className="absolute -top-4 -right-4 p-2 opacity-5"><Gift size={100}/></div>
                        <h4 className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-4">Season Rewards</h4>
                        <div className="space-y-3 text-xs relative z-10">
                            <div className="flex justify-between items-center font-bold border-b border-gray-200 dark:border-slate-700 pb-2">
                                <span className="text-gray-600 dark:text-slate-300 flex items-center gap-1.5"><Crown size={14} className="text-yellow-500"/> 1st Place</span>
                                <span className="text-gray-900 dark:text-white bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded">5000 XP</span>
                            </div>
                            <div className="flex justify-between items-center font-bold border-b border-gray-200 dark:border-slate-700 pb-2">
                                <span className="text-gray-600 dark:text-slate-300 flex items-center gap-1.5"><Medal size={14} className="text-gray-400"/> 2nd Place</span>
                                <span className="text-gray-900 dark:text-white bg-gray-200 dark:bg-slate-700 px-2 py-0.5 rounded">2500 XP</span>
                            </div>
                            <div className="flex justify-between items-center font-bold">
                                <span className="text-gray-600 dark:text-slate-300 flex items-center gap-1.5"><Gem size={14} className="text-orange-700 dark:text-orange-500"/> 3rd Place</span>
                                <span className="text-gray-900 dark:text-white bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded">1000 XP</span>
                            </div>
                        </div>
                    </div>
                 </div>
             ) : (
                <div className="p-6 bg-white dark:bg-slate-900 flex flex-col justify-center h-[220px]">
                    {champion ? (() => {
                        const stats = getProgressStats(champion.score);
                        return (
                            <>
                                <div className="flex justify-between items-end mb-3">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current Rank</span>
                                        <span className={`text-base font-black uppercase ${getTier(1, champion.score, 'all').color}`}>{getTier(1, champion.score, 'all').title}</span>
                                    </div>
                                    <div className="text-right">
                                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Next Rank</span>
                                         <span className="block text-base font-black uppercase text-gray-900 dark:text-white">{stats.nextTitle}</span>
                                    </div>
                                </div>
                                
                                {/* PROGRESS BAR */}
                                <div className="h-5 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden relative border-2 border-gray-300 dark:border-slate-600">
                                    <motion.div 
                                        initial={{ width: 0 }} animate={{ width: `${stats.percent}%` }} transition={{ duration: 1, ease: "circOut" }}
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 relative"
                                    >
                                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30"></div>
                                    </motion.div>
                                </div>
                                
                                <div className="flex justify-between items-center mt-3 text-[10px] font-bold text-gray-500 dark:text-slate-400 font-mono tracking-wider">
                                    <span>{stats.current.toLocaleString()} XP</span>
                                    <span>{stats.max === stats.current ? "MAX LEVEL" : `${stats.max.toLocaleString()} XP`}</span>
                                </div>
                            </>
                        );
                    })() : <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">Awaiting Champion Data</div>}
                </div>
             )}
        </div>
      </motion.div>
    </div>

    {/* ADMIN MODALS */}
    <ConfirmModal isOpen={confirmStart} onClose={() => setConfirmStart(false)} onConfirm={() => startSeasonMutation.mutate()} title="START NEW SEASON?" message="This will clear the board and start a new race. Are you ready?" confirmText="START SEASON" confirmColor="bg-green-600 hover:bg-green-700" />
    <ConfirmModal isOpen={confirmEnd} onClose={() => setConfirmEnd(false)} onConfirm={() => endSeasonMutation.mutate()} title="END SEASON?" message="This will freeze rankings and award 5000 XP to the winner." confirmText="END SEASON" confirmColor="bg-red-600 hover:bg-red-700" />
    <ConfirmModal isOpen={confirmNuke} onClose={() => setConfirmNuke(false)} onConfirm={() => resetAllMutation.mutate()} title="FACTORY RESET" message="This will wipe ALL scores and history. Cannot be undone." confirmText="NUKE EVERYTHING" isDangerous={true} />
    </>
  );
};

export default LeaderboardModal;