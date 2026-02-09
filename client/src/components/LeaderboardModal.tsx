import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Trophy, Flame, Medal, Crown, Shield, Star, Timer, Target, Play, Square, AlertOctagon, Gift } from 'lucide-react';
import client from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal';

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
            <div className={`flex items-center gap-1.5 bg-red-100 dark:bg-red-900/30 border border-red-500 px-2 py-0.5 rounded text-red-700 dark:text-red-400 font-black text-[10px] uppercase shadow-sm ${minimal ? '' : 'md:px-3 md:py-1 md:text-xs'}`}>
                <Square size={minimal ? 10 : 12} fill="currentColor" />
                <span>ENDED</span>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 border border-green-500 px-2 py-0.5 rounded text-green-700 dark:text-green-400 font-black text-[10px] uppercase shadow-sm ${minimal ? '' : 'md:px-3 md:py-1 md:text-xs'}`}>
            <Timer size={minimal ? 10 : 12} />
            <span>{timeLeft}</span>
        </div>
    );
};

const LeaderboardModal = ({ isOpen, onClose }: any) => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [timeframe, setTimeframe] = useState<'monthly' | 'all'>('monthly');
  
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
  const champion = leaders.length > 0 ? leaders[0] : null;

  // --- STYLING ---
  const getRankStyles = (rank: number) => {
    if (rank === 0) return { bg: "bg-gray-50 dark:bg-slate-900", border: "border-gray-100 dark:border-slate-800", icon: <span className="text-xs font-mono opacity-50">-</span> };
    if (rank === 1) return { bg: "bg-yellow-50 dark:bg-yellow-900/20", border: "border-yellow-500", icon: <Crown size={18} className="text-yellow-600 dark:text-yellow-400" fill="currentColor"/> };
    if (rank <= 3) return { bg: "bg-indigo-50 dark:bg-indigo-900/20", border: "border-indigo-500", icon: <Medal size={18} className="text-indigo-600 dark:text-indigo-400" fill="currentColor"/> };
    if (rank <= 10) return { bg: "bg-white dark:bg-slate-800", border: "border-slate-300 dark:border-slate-600", icon: <Shield size={16} className="text-slate-400" fill="currentColor"/> };
    return { bg: "bg-white dark:bg-slate-800", border: "border-gray-200 dark:border-slate-700", icon: <Star size={16} className="text-gray-400" /> };
  };

  const UserRow = ({ user, rank, isMe }: any) => {
    const style = getRankStyles(rank);
    return (
      <div className={`flex items-center gap-3 p-3 rounded-xl border-b-4 border-r-2 border-l-2 border-t-2 transition-transform hover:scale-[1.01] relative ${style.bg} ${style.border} ${isMe ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 z-10' : ''}`}>
        <div className="w-8 flex justify-center font-black text-gray-500 dark:text-slate-400">
            {/* ✅ UNRANKED FIX */}
            {rank <= 3 && rank > 0 ? style.icon : (rank === 0 ? '-' : `#${rank}`)}
        </div>
        <div className={`w-10 h-10 rounded-lg border-2 overflow-hidden bg-gray-200 dark:bg-slate-700 ${style.border}`}>
            {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-500">{user.name?.[0]}</div>}
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <span className={`text-sm font-black truncate uppercase ${isMe ? 'text-indigo-600 dark:text-indigo-400' : (rank === 0 ? 'text-gray-400' : 'text-gray-900 dark:text-white')}`}>
                    {user.name} {isMe && '(YOU)'}
                </span>
            </div>
            {rank > 0 && <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-1.5 rounded flex items-center gap-1"><Flame size={10} fill="currentColor" /> {user.streak} Streak</span></div>}
        </div>
        <div className="text-right">
            <span className={`block text-lg font-black leading-none ${rank === 0 ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>{user.score}</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase">XP</span>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-[1070] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[85vh] rounded-xl border-4 border-gray-900 dark:border-slate-500 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.5)] flex flex-col md:flex-row overflow-hidden">
        
        {/* --- LEFT: LADDER --- */}
        <div className="flex-1 flex flex-col border-r-4 border-gray-900 dark:border-slate-500 bg-gray-50 dark:bg-slate-800">
            
            <div className="p-4 md:p-6 border-b-4 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex justify-between items-center">
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tighter">
                            <Trophy className="text-yellow-500 hidden md:block" fill="currentColor" size={24} /> 
                            Hall of Fame
                        </h2>
                        {timeframe === 'monthly' && (
                            <div className="md:hidden">
                                <SeasonCountdown isEnded={isSeasonEnded} minimal={true} />
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-slate-400 font-bold tracking-widest mt-1">
                        {timeframe === 'monthly' ? "SEASON BATTLE" : "LEGENDS ARCHIVE"}
                    </p>
                </div>
                <button onClick={onClose} className="md:hidden p-2 bg-red-500 text-white rounded border-2 border-red-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"><X size={16}/></button>
            </div>

            <div className="px-4 py-3 md:px-6 md:py-4 flex items-center justify-between border-b-4 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-900">
                <div className="flex gap-2">
                    <button onClick={() => setTimeframe('monthly')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-[10px] md:text-xs font-black uppercase border-2 transition-all shadow-sm active:translate-y-[1px] active:shadow-none ${timeframe === 'monthly' ? 'bg-indigo-500 border-indigo-700 text-white' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-500 hover:bg-gray-50'}`}>Season</button>
                    <button onClick={() => setTimeframe('all')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-[10px] md:text-xs font-black uppercase border-2 transition-all shadow-sm active:translate-y-[1px] active:shadow-none ${timeframe === 'all' ? 'bg-indigo-500 border-indigo-700 text-white' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-500 hover:bg-gray-50'}`}>All Time</button>
                </div>

                {isAdmin && timeframe === 'monthly' && (
                    <>
                    {isSeasonEnded ? (
                        <button onClick={() => setConfirmStart(true)} className="text-[10px] md:text-xs bg-green-100 text-green-700 px-2 py-1.5 md:px-3 md:py-2 rounded border-2 border-green-300 font-bold hover:bg-green-200 flex items-center gap-1 shadow-sm active:translate-y-0.5"><Play size={12} fill="currentColor"/> START</button>
                    ) : (
                        <button onClick={() => setConfirmEnd(true)} className="text-[10px] md:text-xs bg-red-100 text-red-700 px-2 py-1.5 md:px-3 md:py-2 rounded border-2 border-red-300 font-bold hover:bg-red-200 flex items-center gap-1 shadow-sm active:translate-y-0.5"><Square size={12} fill="currentColor"/> END</button>
                    )}
                    </>
                )}
                {isAdmin && timeframe === 'all' && (
                    <button onClick={() => setConfirmNuke(true)} className="text-[10px] md:text-xs bg-red-100 text-red-700 px-2 py-1.5 md:px-3 md:py-2 rounded border-2 border-red-300 font-bold hover:bg-red-200 flex items-center gap-1 animate-pulse"><AlertOctagon size={12}/> NUKE</button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {isLoading ? <div className="text-center py-20 font-bold text-gray-400">Loading...</div> : (
                    <>
                        {/* ✅ MOBILE CHAMPION CARD (Visible only on mobile) */}
                        <div className="md:hidden mb-4 p-4 rounded-xl bg-gradient-to-br from-indigo-900 to-slate-900 border-2 border-yellow-500 text-center relative overflow-hidden shadow-lg">
                             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                             <div className="relative z-10 flex flex-col items-center">
                                <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest mb-2">{isSeasonEnded ? "SEASON WINNER" : "CURRENT LEADER"}</span>
                                <div className="w-16 h-16 rounded-full border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] overflow-hidden mb-2">
                                     {champion ? <img src={champion.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center"><Target size={24} className="text-slate-600"/></div>}
                                </div>
                                <div className="text-white font-black uppercase text-lg leading-none">{champion ? champion.name : "VACANT"}</div>
                                <div className="text-yellow-500 text-xs font-bold mt-0.5">{champion ? `${champion.score} XP` : "No Data"}</div>
                             </div>
                        </div>

                        {leaders.length > 0 ? leaders.map((user: any) => <UserRow key={user.id} user={user} rank={user.rank} isMe={user.id === currentUser?.id} />) 
                        : <div className="text-center py-20 font-bold text-gray-400 uppercase">{isSeasonEnded ? "Season Ended" : "No Champions Yet"}</div>}
                    </>
                )}
            </div>
            
            {!isLoading && myStats && myStats.rank > 10 && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border-t-4 border-indigo-200 dark:border-indigo-900/30">
                    <UserRow user={myStats} rank={myStats.rank} isMe={true} />
                </div>
            )}
        </div>

        {/* --- RIGHT: THRONE (Hidden on Mobile) --- */}
        <div className="hidden md:flex flex-col w-[380px] bg-gray-100 dark:bg-slate-800 relative">
             <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 bg-red-500 hover:bg-red-400 text-white rounded border-2 border-red-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"><X size={20}/></button>
             
             <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                 <div className="mb-8 flex flex-col items-center gap-3">
                     <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                        {isSeasonEnded ? "SEASON CHAMPION" : (champion ? "CURRENT LEADER" : "SEASON STATUS")}
                     </span>
                     {timeframe === 'monthly' && <SeasonCountdown isEnded={isSeasonEnded} />}
                 </div>

                 <div className="relative mb-6">
                    {champion && <Crown size={56} className={`absolute -top-10 left-1/2 -translate-x-1/2 drop-shadow-md transform -rotate-12 z-10 ${isSeasonEnded ? 'text-yellow-500' : 'text-gray-300 dark:text-slate-600 opacity-50'}`} fill="currentColor" />}
                    
                    <div className={`w-40 h-40 rounded-2xl border-4 bg-white dark:bg-slate-700 flex items-center justify-center shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] overflow-hidden ${champion ? 'border-yellow-500' : 'border-gray-300 dark:border-slate-600 border-dashed'}`}>
                         {champion ? <img src={champion.avatar} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center text-gray-300 dark:text-slate-600"><Target size={48} /><span className="text-xs font-black mt-2 uppercase">Vacant</span></div>}
                    </div>
                    
                    {champion && <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 text-xs font-black px-4 py-1 rounded border-2 uppercase tracking-wider shadow-sm whitespace-nowrap z-10 ${isSeasonEnded ? 'bg-yellow-500 text-black border-black' : 'bg-gray-200 text-gray-600 border-gray-400 dark:bg-slate-600 dark:text-white'}`}>
                        {isSeasonEnded ? "WINNER" : "LEADING"}
                    </div>}
                 </div>

                 <div>
                    <h3 className={`text-2xl font-black uppercase leading-tight ${champion ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'}`}>{champion ? champion.name : (isSeasonEnded ? "Wait for Start" : "Vacant Throne")}</h3>
                    <p className="text-sm font-bold text-indigo-500 mt-1">{champion ? `${champion.score} XP` : "Join the battle"}</p>
                 </div>
             </div>
             
             <div className="p-6 border-t-4 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <div className="border-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-4 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><Gift size={64}/></div>
                    <h4 className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-3">Season Rewards</h4>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center font-bold"><span className="text-gray-600 dark:text-slate-300 flex items-center gap-1"><Crown size={12} className="text-yellow-500"/> 1st Place</span><span className="text-gray-900 dark:text-white">5000 XP + Gold Frame</span></div>
                        <div className="flex justify-between items-center font-bold"><span className="text-gray-600 dark:text-slate-300 flex items-center gap-1"><Medal size={12} className="text-gray-400"/> 2nd Place</span><span className="text-gray-900 dark:text-white">2500 XP + Silver Badge</span></div>
                    </div>
                </div>
             </div>
        </div>
      </motion.div>
    </div>

    {/* --- CONFIRMATION MODALS --- */}
    <ConfirmModal isOpen={confirmStart} onClose={() => setConfirmStart(false)} onConfirm={() => startSeasonMutation.mutate()} title="START NEW SEASON?" message="This will clear the board and start a new race. Are you ready?" confirmText="START SEASON" confirmColor="bg-green-600 hover:bg-green-700" />
    <ConfirmModal isOpen={confirmEnd} onClose={() => setConfirmEnd(false)} onConfirm={() => endSeasonMutation.mutate()} title="END SEASON?" message="This will freeze rankings and award 5000 XP to the winner." confirmText="END SEASON" confirmColor="bg-red-600 hover:bg-red-700" />
    <ConfirmModal isOpen={confirmNuke} onClose={() => setConfirmNuke(false)} onConfirm={() => resetAllMutation.mutate()} title="FACTORY RESET" message="This will wipe ALL scores and history. Cannot be undone." confirmText="NUKE EVERYTHING" isDangerous={true} />
    </>
  );
};

export default LeaderboardModal;