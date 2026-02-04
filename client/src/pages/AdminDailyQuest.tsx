import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Send, ArrowLeft, Loader2, 
  Clock, Users, UserCheck, UserX, 
  History, StopCircle, Plus, X,
  ChevronLeft, ChevronRight, Calendar, BarChart2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { toast } from 'react-toastify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- TYPES ---
interface Option { id?: string; text: string; isCorrect: boolean; }
interface DashboardData {
  activeQuest: any;
  totalUsers: number;
  history: any[];
}

// --- 1. COUNTDOWN TIMER ---
const CountdownTimer = ({ expiresAt }: { expiresAt: string }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(expiresAt).getTime();
      const distance = end - now;

      if (distance < 0) {
        setTimeLeft("EXPIRED");
        clearInterval(timer);
        return;
      }

      const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((distance % (1000 * 60)) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  return (
    <div className="flex items-center gap-2 bg-blue-50/50 dark:bg-blue-900/10 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800/30">
        <Clock size={14} className="text-blue-600 dark:text-blue-400" />
        <span className="font-mono font-bold text-sm text-blue-700 dark:text-blue-300">{timeLeft}</span>
    </div>
  );
};

// --- 2. CREATE QUEST MODAL ---
const CreateQuestModal = ({ isOpen, onClose, onSuccess }: any) => {
    const [question, setQuestion] = useState('');
    const [expiresInHours, setExpiresInHours] = useState('24');
    const [options, setOptions] = useState<Option[]>([
        { text: '', isCorrect: false }, { text: '', isCorrect: false },
        { text: '', isCorrect: false }, { text: '', isCorrect: false },
    ]);

    const launchMutation = useMutation({
        mutationFn: async (payload: any) => client.post('/daily/create', payload),
        onSuccess: () => {
            onSuccess();
            toast.success("🚀 Quest Deployed!");
            setQuestion('');
            setOptions(options.map(o => ({ ...o, text: '' })));
            onClose();
        },
        onError: (err: any) => toast.error(err.response?.data?.message || "Launch failed")
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!question.trim() || options.some(opt => !opt.text.trim())) {
            toast.warning("Please complete the question and all options.");
            return;
        }
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + parseInt(expiresInHours));
        launchMutation.mutate({ question, options, expiresAt: expiryDate.toISOString() });
    };

    const handleOptionChange = (idx: number, val: string) => {
        const newOpts = [...options];
        newOpts[idx].text = val;
        setOptions(newOpts);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-[#1A1D21] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-white/5">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2"><Sparkles className="text-yellow-500 fill-yellow-500" size={20} /> New Daily Quest</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500"><X size={20} /></button>
                </div>
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Question</label>
                            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-lg font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="e.g. What's the priority for Q3?" rows={3} autoFocus />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {options.map((opt, idx) => (
                                <div key={idx}>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 mb-1 block">Option {idx + 1}</label>
                                    <input type="text" value={opt.text} onChange={(e) => handleOptionChange(idx, e.target.value)} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white focus:border-purple-500 outline-none" placeholder={`Choice ${idx + 1}...`} />
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between pt-4">
                             <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-3 py-2 rounded-xl">
                                <Clock size={16} className="text-gray-500" />
                                <select value={expiresInHours} onChange={(e) => setExpiresInHours(e.target.value)} className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-200 outline-none cursor-pointer">
                                    <option value="4">4 Hours</option>
                                    <option value="8">8 Hours</option>
                                    <option value="24">24 Hours</option>
                                    <option value="48">48 Hours</option>
                                </select>
                             </div>
                             <button type="submit" disabled={launchMutation.isPending} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50">
                                {launchMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} Launch
                             </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

// --- 3. HISTORY MODAL ---
const HistoryModal = ({ isOpen, onClose, history }: any) => {
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 5;
    const totalPages = Math.ceil((history?.length || 0) / ITEMS_PER_PAGE);
    
    const paginatedHistory = history?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-[#1A1D21] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-white/5">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2"><History size={20} /> Quest History</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500"><X size={20} /></button>
                </div>
                <div className="p-6 min-h-[400px] flex flex-col">
                    <div className="flex-1 space-y-3">
                        {paginatedHistory?.length > 0 ? paginatedHistory.map((h: any) => (
                            <div key={h.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 flex justify-between items-center group hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                                <div className="min-w-0 pr-4">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{h.question}</p>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-[10px] text-gray-500 flex items-center gap-1"><Calendar size={10} /> {new Date(h.createdAt).toLocaleDateString()}</span>
                                        <span className="text-[10px] text-gray-500 flex items-center gap-1"><Clock size={10} /> {new Date(h.createdAt).toLocaleTimeString()}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg">{h._count.responses} Votes</span>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">Closed</span>
                                </div>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                                <History size={48} className="mb-2" />
                                <p>No history found</p>
                            </div>
                        )}
                    </div>
                    
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center pt-6 mt-2 border-t border-gray-100 dark:border-white/5">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30"><ChevronLeft size={20} /></button>
                            <span className="text-xs font-bold text-gray-500">Page {page} of {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30"><ChevronRight size={20} /></button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// --- MAIN PAGE ---
const AdminDailyQuest = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // FETCH DATA
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['quest-stats'],
    queryFn: async () => (await client.get('/daily/stats')).data,
    refetchInterval: 3000, 
  });

  const activeQuest = data?.activeQuest;
  const totalUsers = data?.totalUsers || 0;
  const totalVotes = activeQuest?.responses?.length || 0;
  const pendingVotes = Math.max(0, totalUsers - totalVotes);

  const closeMutation = useMutation({
    mutationFn: async () => client.patch(`/daily/${activeQuest?.id}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quest-stats'] });
      queryClient.invalidateQueries({ queryKey: ['active-question'] });
      toast.info("Quest closed manually.");
    }
  });

  const refreshData = () => queryClient.invalidateQueries({ queryKey: ['quest-stats'] });

  if (isLoading) return <div className="h-screen flex items-center justify-center dark:bg-[#0B0D0F]"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] p-6 lg:p-10 font-sans text-gray-900 dark:text-white transition-colors duration-500">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER & ACTIONS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div>
                <button onClick={() => navigate(-1)} className="group flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors text-sm font-bold mb-2">
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                </button>
                <h1 className="text-3xl font-black tracking-tight">Quest Command Center</h1>
            </div>
            <div className="flex gap-3">
                <button onClick={() => setIsHistoryOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                    <History size={16} /> History
                </button>
                <button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95">
                    <Plus size={18} /> New Quest
                </button>
            </div>
        </div>

        {/* --- MAIN GRID --- */}
        {activeQuest ? (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                
                {/* 1. LEFT: ACTIVE QUEST CARD (Integrated) */}
                <div className="xl:col-span-7 flex flex-col gap-6">
                    <div className="bg-white dark:bg-[#16181D] rounded-[2rem] p-8 border border-gray-200 dark:border-white/5 shadow-xl relative overflow-hidden flex flex-col h-full">
                        
                        {/* Decorative Background */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                        {/* Top Meta Row */}
                        <div className="flex justify-between items-start mb-6 relative z-10">
                             <div className="flex flex-col gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black uppercase tracking-widest w-fit">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Live Quest
                                </span>
                                <CountdownTimer expiresAt={activeQuest.expiresAt} />
                             </div>
                             <button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-xl transition-colors" title="End Quest">
                                <StopCircle size={24} />
                             </button>
                        </div>

                        {/* ✅ THE EXCITING TITLE */}
                        <h2 className="text-4xl md:text-5xl font-black leading-tight mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 relative z-10 drop-shadow-sm">
                            {activeQuest.question}
                        </h2>

                        {/* ✅ LIVE BREAKDOWN INSIDE HERO */}
                        <div className="space-y-4 mb-8 flex-1 relative z-10">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2"><BarChart2 size={14}/> Live Results</h3>
                            {activeQuest.options.map((opt: any) => {
                                const count = activeQuest.responses?.filter((r: any) => r.optionId === opt.id).length || 0;
                                const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                                const isWinner = pct > 0 && pct === Math.max(...activeQuest.options.map((o: any) => {
                                    const c = activeQuest.responses?.filter((r: any) => r.optionId === o.id).length || 0;
                                    return totalVotes > 0 ? (c / totalVotes) * 100 : 0;
                                }));

                                return (
                                    <div key={opt.id} className="relative group">
                                        <div className="flex justify-between text-xs font-bold mb-1.5 z-10 relative">
                                            <span className="text-gray-700 dark:text-gray-200">{opt.text}</span>
                                            <span className="text-blue-600 dark:text-blue-400">{Math.round(pct)}% <span className="text-gray-400 font-normal">({count})</span></span>
                                        </div>
                                        {/* Bar Background */}
                                        <div className="h-3 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }} 
                                                animate={{ width: `${pct}%` }} 
                                                transition={{ duration: 1, ease: "easeOut" }} 
                                                className={`h-full rounded-full ${isWinner ? 'bg-gradient-to-r from-green-400 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-blue-500/50'}`} 
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Bottom Stats */}
                        <div className="grid grid-cols-2 gap-4 mt-auto relative z-10 pt-6 border-t border-gray-100 dark:border-white/5">
                             <div className="bg-gray-50 dark:bg-black/20 rounded-2xl p-4 text-center border border-gray-100 dark:border-white/5">
                                 <div className="text-3xl font-black text-blue-600 dark:text-blue-400">{totalVotes}</div>
                                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center gap-1"><Users size={12}/> Voted</div>
                             </div>
                             <div className="bg-gray-50 dark:bg-black/20 rounded-2xl p-4 text-center border border-gray-100 dark:border-white/5 opacity-60">
                                 <div className="text-3xl font-black text-gray-500">{pendingVotes}</div>
                                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center gap-1"><UserX size={12}/> Pending</div>
                             </div>
                        </div>
                    </div>
                </div>

                {/* 2. RIGHT: VOTER LOG (5 Cols) */}
                <div className="xl:col-span-5">
                    <div className="bg-white dark:bg-[#16181D] rounded-[2rem] border border-gray-200 dark:border-white/5 shadow-xl flex flex-col h-full min-h-[600px] overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex justify-between items-center">
                             <div>
                                 <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <UserCheck size={20} className="text-green-500" /> Voter Log
                                 </h3>
                                 <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Real-time Feed</p>
                             </div>
                             <span className="bg-white dark:bg-white/10 px-3 py-1 rounded-lg text-xs font-bold border border-gray-200 dark:border-white/5 shadow-sm">
                                {totalVotes} Entries
                             </span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                            {activeQuest.responses?.length > 0 ? (
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 dark:bg-black/20 text-[10px] uppercase text-gray-400 sticky top-0 z-10 backdrop-blur-md">
                                        <tr>
                                            <th className="px-6 py-3 font-bold">User</th>
                                            <th className="px-6 py-3 font-bold">Answer</th>
                                            <th className="px-6 py-3 font-bold text-right">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                        {activeQuest.responses.map((resp: any) => (
                                            <tr key={resp.id} className="hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors group">
                                                <td className="px-6 py-4 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold text-xs overflow-hidden border border-indigo-200 dark:border-indigo-800">
                                                        {resp.user?.avatar ? <img src={resp.user.avatar} className="w-full h-full object-cover"/> : resp.user?.name?.[0]}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-sm text-gray-900 dark:text-white truncate max-w-[100px]">{resp.user?.name || 'Unknown'}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm whitespace-nowrap">
                                                        {resp.option?.text}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-[10px] text-gray-400 font-mono whitespace-nowrap">
                                                    {new Date(resp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-40">
                                    <UserX size={48} className="mb-4" strokeWidth={1} />
                                    <span className="text-sm font-bold uppercase tracking-widest">No Votes Yet</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <Sparkles size={40} className="text-gray-300" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">System Idle</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">No active quest found. Launch a new challenge to engage the team.</p>
                <button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-xl hover:scale-105 transition-all">
                    <Plus size={20} /> Create New Quest
                </button>
            </div>
        )}

        {/* MODALS */}
        <CreateQuestModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={refreshData} />
        <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={data?.history} />

      </div>
    </div>
  );
};

export default AdminDailyQuest;