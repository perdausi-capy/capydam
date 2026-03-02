import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Medal, Gem, X, Sparkles, ChevronRight, ChevronLeft, Info, Target, TrendingUp, Lock, Flame, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import fanfareSound from '../../../assets/fanfareSound.mp3';

interface SeasonRecapModalProps {
    recapData: any;
    currentUser: any;
}

export const SeasonRecapModal = ({ recapData, currentUser }: SeasonRecapModalProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);
    const [view, setView] = useState<'podium' | 'summary'>('podium');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // ✅ Map data directly from the frozen snapshot
    const leaders = recapData?.leaders || [];
    const seasonName = recapData?.seasonName || "Previous";
    
    // Find the current user's frozen stats from the snapshot
    const myStats = leaders.find((u: any) => u.id === currentUser?.id);
    
    // Unique key so it only shows once per user per season
    const storageKey = recapData ? `capydam_recap_seen_${seasonName.replace(/\s+/g, '')}` : null;

    useEffect(() => {
        audioRef.current = new Audio(fanfareSound);
        audioRef.current.volume = 0.6;
    }, []);

    // ✅ Trigger Modal ONLY if recapData exists and they haven't seen it yet
    useEffect(() => {
        if (recapData && storageKey && !localStorage.getItem(storageKey)) {
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [recapData, storageKey]);

    const handleReveal = () => {
        setIsRevealed(true);
        triggerConfetti(); 

        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.warn("Audio play blocked:", e));
        }

        setTimeout(() => {
            confetti({
                particleCount: 150,
                spread: 120,
                origin: { y: 0.5 },
                colors: ['#FBBF24', '#F59E0B', '#B45309', '#FFFFFF'], 
                zIndex: 99999
            });
        }, 1500); 
    };

    const triggerConfetti = () => {
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 99999 };
        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            const particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    };

    const handleClose = () => {
        // ✅ Add a check to ensure storageKey exists before using it
        if (storageKey) {
            localStorage.setItem(storageKey, 'true'); 
        }
        setIsOpen(false);
    };

    const getAvatar = (user: any) => {
        if (user?.avatar) return user.avatar;
        return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${user?.name || 'player'}&backgroundColor=1e293b`;
    };

    // ✅ HELPER: Formats timestamp to precise HH:MM:SS.ms AM/PM
    const formatDetailedTime = (timestamp: number) => {
        if (!timestamp) return 'No Time Data';
        const d = new Date(timestamp);
        const timeString = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
        const parts = timeString.split(' ');
        return `${parts[0]}.${d.getMilliseconds().toString().padStart(3, '0')} ${parts[1]}`;
    };

    // ✅ HELPER: Determines exactly why this user beat the person below them
    const getWinReasonUI = (currentUser: any, nextUser: any) => {
        if (!nextUser) return null; 
        
        // 1. Won by pure score
        if (currentUser.score > nextUser.score) {
            return (
                <span className="text-[9px] text-emerald-400/90 flex items-center gap-1 font-medium tracking-wide mt-0.5">
                    <TrendingUp size={10}/> +{currentUser.score - nextUser.score} XP Lead
                </span>
            );
        }
        // 2. Scores tied -> Won by Streak
        if ((currentUser.streak || 0) > (nextUser.streak || 0)) {
            return (
                <span className="text-[9px] text-orange-400/90 flex items-center gap-1 font-medium tracking-wide mt-0.5">
                    <Flame size={10}/> Tie: Streak ({currentUser.streak} vs {nextUser.streak})
                </span>
            );
        }
        // 3. Scores & Streaks tied -> Won by Speed
        if (currentUser.timeReached && nextUser.timeReached && currentUser.timeReached <= nextUser.timeReached) {
            const diffMs = nextUser.timeReached - currentUser.timeReached;
            const diffSec = (diffMs / 1000).toFixed(3);
            return (
                <span className="text-[9px] text-yellow-400/90 flex flex-col items-start font-medium tracking-wide mt-1">
                    <span className="flex items-center gap-1"><Zap size={10}/> Tie: {diffSec}s faster</span>
                    <span className="text-[8px] text-yellow-400/60 ml-[14px]">Lock: {formatDetailedTime(currentUser.timeReached)}</span>
                </span>
            );
        }
        return null; 
    };

    if (!isOpen) return null;

    const first = leaders[0];
    const second = leaders[1];
    const third = leaders[2];
    
    // Getting the NEXT 10 users (Ranks 4 through 13)
    const nextTopTen = leaders.slice(3, 13); 
    const isUserOutsideTop13 = myStats && myStats.rank > 13;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" />
            
            <motion.div 
                layout 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                className={`relative w-full ${view === 'podium' ? 'max-w-4xl' : 'max-w-5xl'} bg-gradient-to-b from-slate-900 via-slate-900 to-black border border-slate-800 rounded-[2.5rem] shadow-[0_0_150px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col items-center p-8 md:p-12 text-center min-h-[550px] transition-all duration-500`}
            >
                {/* Ambient Glow */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay pointer-events-none"></div>
                <motion.div 
                    animate={{ rotate: 360, scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[30%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none"
                />

                <button onClick={handleClose} className="absolute top-6 right-6 text-slate-500 hover:text-white bg-slate-800/50 hover:bg-slate-700 p-2 rounded-full transition-all z-50">
                    <X size={24} />
                </button>

                <AnimatePresence mode="wait">
                    {/* =========================================================
                        PAGE 1: THE PODIUM
                    ========================================================= */}
                    {view === 'podium' ? (
                        <motion.div key="podium" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center w-full">
                            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                                <h3 className="text-amber-500/80 font-bold tracking-[0.4em] uppercase text-xs mb-3 z-10 flex items-center justify-center gap-2">
                                    <Sparkles size={14}/> {seasonName} Finale
                                </h3>
                                <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 uppercase tracking-tighter mb-10 z-10 drop-shadow-2xl">
                                    CAPY CHAMPION
                                </h1>
                            </motion.div>

                            {/* 🔒 PRE-REVEAL STATE */}
                            {!isRevealed ? (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center z-10 w-full mb-8">
                                    
                                    {/* Mystery Silhouette Podium */}
                                    <div className="flex items-end justify-center gap-2 md:gap-4 w-full max-w-3xl h-48 md:h-56 mb-12 opacity-40 grayscale-[50%] blur-[2px] pointer-events-none select-none">
                                        <div className="flex flex-col items-center w-1/3 relative">
                                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-slate-700 bg-slate-800/80 -mb-5 z-20"></div>
                                            <div className="w-full h-28 md:h-32 bg-slate-800/50 border-x border-t border-slate-700 rounded-t-2xl"></div>
                                        </div>
                                        <div className="flex flex-col items-center w-[40%] relative z-30">
                                            <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-[5px] border-amber-900/50 bg-slate-800/80 -mb-6 z-20 flex items-center justify-center">
                                                <Lock size={36} className="text-amber-700/50" />
                                            </div>
                                            <div className="w-full h-36 md:h-44 bg-amber-900/20 border-x border-t border-amber-900/30 rounded-t-2xl"></div>
                                        </div>
                                        <div className="flex flex-col items-center w-1/3 relative">
                                            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-4 border-slate-700 bg-slate-800/80 -mb-4 z-20"></div>
                                            <div className="w-full h-24 md:h-28 bg-slate-800/50 border-x border-t border-slate-700 rounded-t-2xl"></div>
                                        </div>
                                    </div>

                                    <p className="text-amber-500/60 font-mono text-xs mb-6 uppercase tracking-[0.3em] animate-pulse">
                                        Data Encrypted & Locked
                                    </p>

                                    <button onClick={handleReveal} className="group relative px-12 py-6 bg-amber-500 text-slate-950 font-black text-xl md:text-2xl uppercase tracking-widest rounded-2xl shadow-[0_0_40px_rgba(245,158,11,0.3)] hover:shadow-[0_0_60px_rgba(245,158,11,0.6)] hover:-translate-y-1 active:translate-y-1 transition-all overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] skew-x-12" />
                                        <span className="relative flex items-center gap-3"><Crown size={28} /> Reveal Champions</span>
                                    </button>
                                </motion.div>
                            ) : (
                                /* 🔓 POST-REVEAL STATE */
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center w-full z-10">
                                    <div className="flex items-end justify-center gap-2 md:gap-4 mb-16 w-full max-w-3xl h-64 md:h-72">
                                        {/* 2ND PLACE */}
                                        {second && (
                                            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, type: 'spring', damping: 20 }} className="flex flex-col items-center w-1/3 relative z-10">
                                                <div className="relative z-20 flex flex-col items-center -mb-5">
                                                    {currentUser?.id === second.id && <span className="absolute -top-8 bg-slate-100 text-slate-800 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg animate-bounce z-40">You!</span>}
                                                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-slate-300 bg-slate-800 shadow-[0_0_20px_rgba(203,213,225,0.2)] overflow-hidden flex items-center justify-center text-3xl font-black text-slate-300 uppercase">
                                                        <img src={getAvatar(second)} className="w-full h-full object-cover"/>
                                                    </div>
                                                    <div className="absolute -bottom-4 bg-slate-900 rounded-full p-1.5 shadow-lg border border-slate-700">
                                                        <Medal size={20} className="text-slate-300 drop-shadow-md" fill="currentColor" />
                                                    </div>
                                                </div>
                                                <div className="w-full h-28 md:h-32 bg-gradient-to-b from-slate-700/80 to-slate-900 border-x border-t border-slate-600/50 rounded-t-2xl flex flex-col items-center justify-end pb-4 shadow-[inset_0_4px_20px_rgba(255,255,255,0.05)]">
                                                    <span className="font-black text-white text-sm md:text-base uppercase truncate px-2 w-full">{second.name}</span>
                                                    <span className="text-xs text-slate-300 font-mono font-bold mt-1 bg-black/40 px-3 py-1 rounded-lg border border-slate-700/50">{second.score} XP</span>
                                                </div>
                                            </motion.div>
                                        )}
                                        {/* 1ST PLACE */}
                                        {first && (
                                            <motion.div initial={{ y: 150, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.0, type: 'spring', bounce: 0.5 }} className="flex flex-col items-center w-[40%] relative z-30">
                                                <div className="relative z-20 flex flex-col items-center -mb-6">
                                                    {currentUser?.id === first.id && <span className="absolute -top-16 bg-amber-400 text-amber-950 text-[11px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse z-40">Champion!</span>}
                                                    <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-7 z-30">
                                                        <Crown size={40} className="text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" fill="currentColor" />
                                                    </motion.div>
                                                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-[5px] border-amber-400 bg-slate-800 shadow-[0_0_30px_rgba(251,191,36,0.4)] overflow-hidden flex items-center justify-center text-5xl font-black text-amber-400 uppercase">
                                                        <img src={getAvatar(first)} className="w-full h-full object-cover"/>
                                                    </div>
                                                </div>
                                                <div className="w-full h-36 md:h-44 bg-gradient-to-b from-amber-600/80 to-amber-900/90 border-x border-t border-amber-500/50 rounded-t-2xl flex flex-col items-center justify-end pb-5 shadow-[inset_0_4px_30px_rgba(255,255,255,0.1),0_-10px_40px_rgba(245,158,11,0.1)]">
                                                    <span className="font-black text-white text-lg md:text-xl uppercase truncate px-2 w-full drop-shadow-md">{first.name}</span>
                                                    <span className="text-sm text-amber-200 font-mono font-black mt-1 bg-black/40 px-4 py-1.5 rounded-xl border border-amber-500/30">{first.score} XP</span>
                                                </div>
                                            </motion.div>
                                        )}
                                        {/* 3RD PLACE */}
                                        {third && (
                                            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', damping: 20 }} className="flex flex-col items-center w-1/3 relative z-10">
                                                <div className="relative z-20 flex flex-col items-center -mb-4">
                                                    {currentUser?.id === third.id && <span className="absolute -top-8 bg-orange-200 text-orange-900 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg animate-bounce z-40">You!</span>}
                                                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-4 border-orange-500 bg-slate-800 shadow-[0_0_15px_rgba(249,115,22,0.2)] overflow-hidden flex items-center justify-center text-2xl font-black text-orange-500 uppercase">
                                                        <img src={getAvatar(third)} className="w-full h-full object-cover"/>
                                                    </div>
                                                    <div className="absolute -bottom-3 bg-slate-900 rounded-full p-1 shadow-lg border border-slate-700">
                                                        <Gem size={18} className="text-orange-500 drop-shadow-md" fill="currentColor" />
                                                    </div>
                                                </div>
                                                <div className="w-full h-24 md:h-28 bg-gradient-to-b from-orange-800/80 to-slate-900 border-x border-t border-orange-700/50 rounded-t-2xl flex flex-col items-center justify-end pb-3 shadow-[inset_0_4px_20px_rgba(255,255,255,0.05)]">
                                                    <span className="font-black text-slate-200 text-xs md:text-sm uppercase truncate px-2 w-full">{third.name}</span>
                                                    <span className="text-[11px] text-orange-300 font-mono font-bold mt-1 bg-black/40 px-2 py-1 rounded-lg border border-orange-700/50">{third.score} XP</span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>

                                    <motion.button 
                                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3 }}
                                        onClick={() => setView('summary')} 
                                        className="px-8 py-4 bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm uppercase tracking-widest rounded-xl hover:bg-slate-700 hover:text-white hover:border-slate-500 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95 transition-all z-10 flex items-center gap-2"
                                    >
                                        View Battle Report <ChevronRight size={18} />
                                    </motion.button>
                                </motion.div>
                            )}
                        </motion.div>
                    ) : (

                    /* =========================================================
                        PAGE 2: BATTLE SUMMARY & TOP 10 CONTENDERS
                    ========================================================= */
                        <motion.div key="summary" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center w-full z-10 h-full">
                            
                            <div className="w-full flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
                                <button onClick={() => setView('podium')} className="text-slate-400 hover:text-white flex items-center gap-1 font-bold text-sm uppercase tracking-wider transition-colors">
                                    <ChevronLeft size={18}/> Back
                                </button>
                                <div className="flex items-center gap-3">
                                    <Target className="text-indigo-400" size={24}/>
                                    <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest drop-shadow-md">Post-Match Report</h2>
                                </div>
                                <div className="w-20"></div>
                            </div>

                            <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
                                
                                {/* LEFT COLUMN: Top 3 & Rules */}
                                <div className="flex flex-col gap-6 lg:col-span-1">
                                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 shadow-inner">
                                        <h4 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-4 flex items-center gap-2"><Crown size={14}/> The Champions</h4>
                                        <div className="space-y-4">
                                            {[first, second, third].filter(Boolean).map((u: any, i: number) => {
                                                const nextU = i === 0 ? second : i === 1 ? third : nextTopTen[0];
                                                return (
                                                    <div key={u.id} className="flex items-start gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-slate-300/20 text-slate-300' : 'bg-orange-500/20 text-orange-400'}`}>
                                                            #{i + 1}
                                                        </div>
                                                        <img src={getAvatar(u)} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-600 shrink-0" />
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="font-bold text-white text-sm uppercase truncate">{u.name}</div>
                                                            <div className="text-xs text-slate-400 font-mono mb-0.5">{u.score} XP</div>
                                                            {/* ✅ Display exactly why they beat the next person with exact time difference */}
                                                            {getWinReasonUI(u, nextU)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* ✅ Updated Tie-Breaker Info */}
                                    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-5 shadow-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Info className="text-indigo-400 shrink-0" size={16} />
                                            <h4 className="text-indigo-300 font-bold text-xs uppercase tracking-widest">Tie-Breaker Rules</h4>
                                        </div>
                                        <p className="text-xs text-indigo-200/80 leading-relaxed">
                                            If players tie in total XP, the system ranks them based on their <strong className="text-indigo-100">Active Streak</strong>. If still tied, it defaults to <strong className="text-indigo-100">Speed</strong> (who locked in fastest).
                                        </p>
                                    </div>
                                </div>

                                {/* RIGHT COLUMN: Top 10 Contenders Grid (2 Columns, 5x5) */}
                                <div className="lg:col-span-2 flex flex-col">
                                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 shadow-inner flex-1 flex flex-col">
                                        <h4 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-4 flex items-center gap-2"><TrendingUp size={14}/> Top 10 Contenders</h4>
                                        
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-2 custom-scrollbar content-start">
                                            {nextTopTen.map((u: any, i: number) => {
                                                const isMe = currentUser?.id === u.id;
                                                const nextU = nextTopTen[i + 1] || leaders[13 + i]; 
                                                return (
                                                    <div key={u.id} className={`flex items-start justify-between p-3 rounded-xl border transition-all ${isMe ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'}`}>
                                                        <div className="flex items-start gap-3 overflow-hidden">
                                                            <span className="font-black text-slate-500 w-6 text-sm mt-1">#{i + 4}</span>
                                                            <img src={getAvatar(u)} className="w-8 h-8 rounded-full border border-slate-600 bg-slate-800 shrink-0 mt-1" />
                                                            <div className="flex flex-col min-w-0 mt-0.5">
                                                                <span className={`font-bold text-sm truncate flex items-center gap-1 ${isMe ? 'text-indigo-300' : 'text-slate-300'}`}>
                                                                    <span className="truncate">{u.name}</span>
                                                                    {isMe && <span className="text-[9px] font-black bg-indigo-500 text-white px-1.5 py-0.5 rounded ml-1 shrink-0">YOU</span>}
                                                                </span>
                                                                {/* ✅ Display exactly why they beat the next person */}
                                                                {getWinReasonUI(u, nextU)}
                                                            </div>
                                                        </div>
                                                        <span className="font-mono font-bold text-slate-400 text-xs whitespace-nowrap self-start mt-1.5">{u.score} XP</span>
                                                    </div>
                                                );
                                            })}
                                            {nextTopTen.length === 0 && <p className="text-slate-500 italic py-4 col-span-full">No additional players qualified this season.</p>}
                                        </div>

                                        {/* PINNED: User Position if outside top 13 */}
                                        {isUserOutsideTop13 && (
                                            <div className="mt-4 pt-4 border-t border-slate-700/50">
                                                <div className="p-3 rounded-xl border border-indigo-500/50 bg-indigo-500/10 relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay"></div>
                                                    <h4 className="text-indigo-300 font-bold uppercase tracking-widest text-[10px] mb-2">Your Performance</h4>
                                                    <div className="flex items-center justify-between relative z-10">
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-black text-indigo-400 w-6 text-lg">#{myStats.rank}</span>
                                                            <img src={getAvatar(myStats)} className="w-8 h-8 rounded-full border border-indigo-400/50" />
                                                            <span className="font-bold text-white text-sm">{myStats.name}</span>
                                                        </div>
                                                        <span className="font-mono font-black text-indigo-300 bg-indigo-900/50 px-3 py-1 rounded-lg border border-indigo-500/30 shadow-inner">{myStats.score} XP</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <motion.button 
                                onClick={handleClose} 
                                className="mt-8 px-10 py-4 bg-white text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl hover:bg-slate-200 hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                            >
                                Close Report
                            </motion.button>

                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};