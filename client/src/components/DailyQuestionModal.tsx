import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Send, Loader2, CheckCircle2, BarChart3, Trophy, AlertCircle, Skull } from 'lucide-react';
import client from '../api/client';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';

// 🔊 SOUNDS
const WIN_SOUND = "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3";
// const LOSE_SOUND = "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3"; 

// --- GAME BUTTON COMPONENT (Same as Admin) ---
const GameButton = ({ onClick, disabled, className, children, variant = 'primary' }: any) => {
  const colors = {
    primary: "bg-indigo-600 hover:bg-indigo-500 border-indigo-900 text-white",
    success: "bg-emerald-600 hover:bg-emerald-500 border-emerald-900 text-white",
    neutral: "bg-gray-200 hover:bg-gray-300 border-gray-400 text-gray-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:border-slate-900 dark:text-slate-200",
  };
  // @ts-ignore
  const colorClass = colors[variant] || colors.primary;

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`
        relative w-full py-3 font-black uppercase tracking-wider text-sm transition-all
        border-b-4 border-r-2 border-l-2 border-t-2 rounded-lg
        active:border-b-2 active:translate-y-1 disabled:opacity-50 disabled:active:translate-y-0
        ${colorClass} ${className}
      `}
    >
      <div className="flex items-center justify-center gap-2">
        {children}
      </div>
    </button>
  );
};

const DailyQuestionModal = ({ isOpen, onClose, question, onVoteSuccess }: any) => {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // State
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'voting' | 'results'>('voting');
  const [liveStats, setLiveStats] = useState<any[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [earnedPoints, setEarnedPoints] = useState(0);

  // 🔊 Preload Audio
  useEffect(() => {
    audioRef.current = new Audio(WIN_SOUND);
    audioRef.current.volume = 0.5;
  }, []);

  // 🎉 Celebration Effect
  useEffect(() => {
    if (view === 'results' && isCorrect) {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.warn("Audio play failed:", e));
        }
        confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.55 },
            colors: ['#6366f1', '#a855f7', '#ec4899', '#fbbf24'],
            zIndex: 10001
        });
    }
  }, [view, isCorrect]);

  if (!isOpen) return null;

  // --- ACTIONS ---
  const handleVote = async () => {
    if (!selected) return;
    setLoading(true);

    try {
      const { data } = await client.post('/daily/vote', { 
        questionId: question.id, 
        optionId: selected 
      });

      await queryClient.invalidateQueries({ queryKey: ['active-question'] });
      setLiveStats(data.stats); 
      setIsCorrect(data.isCorrect);
      setEarnedPoints(data.points || 0);

      // ✅ FIX: Use JSX Components instead of strings for the icon
      if (data.isCorrect) {
        toast.success(`VICTORY! +${data.points} XP`, { 
            icon: <Trophy size={20} className="text-yellow-400" /> // Using Lucide Icon
        });
      } else {
        toast.error("MISSION FAILED", { 
            icon: <Skull size={20} className="text-gray-400" /> // Using Lucide Icon
        });
      }

      setView('results');

    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to vote");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose(); 
    if (view === 'results' && onVoteSuccess) {
        onVoteSuccess(); 
    }
  };

  const getStats = (optId: string) => {
    const sourceData = liveStats.length > 0 ? liveStats : question.options;
    const optData = sourceData.find((o: any) => o.id === optId);
    const count = optData?._count?.responses ?? optData?.responses?.length ?? 0;
    const total = sourceData.reduce((acc: number, curr: any) => acc + (curr._count?.responses ?? curr.responses?.length ?? 0), 0);
    const pct = total === 0 ? 0 : Math.round((count / total) * 100);
    return { count, pct };
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      
      {/* 🎮 GAME CARD CONTAINER */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 20 }}
        className={`
            relative w-full max-w-lg
            bg-white dark:bg-slate-900 
            border-4 ${isCorrect === true ? 'border-green-500' : isCorrect === false ? 'border-red-500' : 'border-indigo-600'}
            rounded-xl 
            shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]
            overflow-hidden
        `}
      >
        
        {/* Header Strip */}
        <div className={`
            h-14 flex justify-between items-center px-6 border-b-4 
            ${isCorrect === true ? 'bg-green-600 border-green-800' : isCorrect === false ? 'bg-red-600 border-red-800' : 'bg-indigo-600 border-indigo-900'}
        `}>
            <div className="flex items-center gap-2 text-white font-black uppercase tracking-widest text-sm">
                {view === 'results' ? (
                    isCorrect ? <><Trophy size={18}/> VICTORY</> : <><Skull size={18}/> DEFEAT</>
                ) : (
                    <><Sparkles size={18}/> Daily Quest</>
                )}
            </div>
            <button onClick={handleClose} className="text-white/80 hover:text-white transition-colors">
                <X size={24} strokeWidth={3} />
            </button>
        </div>

        <div className="p-8">
            {/* XP Badge (Only on Results) */}
            {view === 'results' && isCorrect && (
                <div className="flex justify-center mb-6">
                    <div className="bg-yellow-400 text-black font-black px-4 py-1 rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] animate-bounce">
                        +{earnedPoints} XP GAINED
                    </div>
                </div>
            )}

            {/* Question Text */}
            <h3 className="text-2xl font-black mb-8 text-gray-900 dark:text-white leading-tight text-center">
                {question.question}
            </h3>

            <AnimatePresence mode='wait'>
                
                {/* === VIEW 1: VOTING === */}
                {view === 'voting' && (
                    <motion.div
                        key="voting"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-4"
                    >
                        <div className="space-y-3">
                            {question.options.map((opt: any) => (
                            <button
                                key={opt.id}
                                onClick={() => setSelected(opt.id)}
                                disabled={loading}
                                className={`
                                    group w-full p-4 rounded-lg border-4 text-left font-bold transition-all relative
                                    ${selected === opt.id 
                                        ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-600 text-indigo-700 dark:text-indigo-300 translate-x-1 translate-y-1 shadow-none' 
                                        : 'bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:border-indigo-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-x-1 active:translate-y-1 active:shadow-none'}
                                `}
                            >
                                <div className="flex justify-between items-center">
                                    <span>{opt.text}</span>
                                    {selected === opt.id && <CheckCircle2 size={20} className="text-indigo-600 dark:text-indigo-400" />}
                                </div>
                            </button>
                            ))}
                        </div>

                        <div className="mt-8">
                            <GameButton 
                                onClick={handleVote} 
                                disabled={!selected || loading} 
                                variant="success"
                            >
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <>LOCK IN ANSWER <Send size={16} /></>}
                            </GameButton>
                        </div>
                    </motion.div>
                )}

                {/* === VIEW 2: RESULTS === */}
                {view === 'results' && (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-6"
                    >
                        {question.options.map((opt: any, idx: number) => {
                            const { count, pct } = getStats(opt.id);
                            const isSelected = selected === opt.id;
                            const isWinner = opt.isCorrect; // Server should return this in 'stats' or we assume logic

                            return (
                                <div key={opt.id} className="relative">
                                    <div className="flex justify-between text-xs font-bold mb-1.5 uppercase tracking-wide">
                                        <span className={`flex items-center gap-2 ${
                                            isWinner ? 'text-green-600 dark:text-green-400' : (isSelected ? 'text-red-500' : 'text-gray-500 dark:text-slate-400')
                                        }`}>
                                            {opt.text}
                                            {isWinner && <CheckCircle2 size={12} />}
                                            {isSelected && !isWinner && <X size={12} />}
                                        </span>
                                        <span className="text-gray-900 dark:text-white">{pct}%</span>
                                    </div>

                                    {/* Retro Bar */}
                                    <div className="h-6 w-full bg-gray-200 dark:bg-slate-800 border-2 border-gray-400 dark:border-slate-600 rounded-sm overflow-hidden relative"> 
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 1, ease: "circOut", delay: idx * 0.1 }}
                                            className={`h-full border-r-2 border-black/20 ${
                                                isWinner ? 'bg-green-500' : (isSelected ? 'bg-red-500' : 'bg-gray-400 dark:bg-slate-600')
                                            }`}
                                        />
                                        {/* Scanline Overlay */}
                                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
                                    </div>
                                    
                                    <div className="text-[10px] text-gray-400 mt-1 text-right font-mono">{count} VOTES</div>
                                </div>
                            );
                        })}

                        <GameButton onClick={handleClose} variant="neutral">
                            Close Interface
                        </GameButton>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default DailyQuestionModal;