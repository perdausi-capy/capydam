import React, { useState, useEffect } from 'react';
import { motion  } from 'framer-motion';
import { 
  Send, ArrowLeft, Loader2, Clock,
  History, StopCircle, Plus, X,
  ChevronLeft, ChevronRight, Wand2, CheckCircle2,
  Database, Bot, Swords, Scroll, Skull, Trophy, Flame, Medal, Crown, Trash2
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

// --- REUSABLE GAME UI COMPONENTS ---
const GameCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`
    bg-white dark:bg-slate-800 
    border-4 border-gray-900 dark:border-slate-600 
    rounded-xl 
    shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.6)]
    transition-colors duration-300
    ${className}
  `}>
    {children}
  </div>
);

const GameButton = ({ onClick, disabled, className, children, variant = 'primary' }: any) => {
  const colors = {
    primary: "bg-indigo-600 hover:bg-indigo-500 border-indigo-900 text-white",
    success: "bg-emerald-600 hover:bg-emerald-500 border-emerald-900 text-white",
    danger: "bg-red-600 hover:bg-red-500 border-red-900 text-white",
    neutral: "bg-gray-200 hover:bg-gray-300 border-gray-400 text-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:border-slate-900 dark:text-slate-200",
    gold: "bg-yellow-500 hover:bg-yellow-400 border-yellow-700 text-black",
  };
  // @ts-ignore
  const colorClass = colors[variant] || colors.primary;

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`
        relative px-4 py-2 font-bold uppercase tracking-wider text-xs transition-all
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
    <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-black/40 px-3 py-1.5 rounded border-2 border-gray-300 dark:border-slate-600">
        <Clock size={14} className="text-orange-600 dark:text-yellow-400" />
        <span className="font-mono font-bold text-sm text-orange-700 dark:text-yellow-400">{timeLeft}</span>
    </div>
  );
};

// --- 2. VOTE DETAIL MODAL (RPG Style) ---
const VoteDetailModal = ({ vote, onClose }: { vote: any, onClose: () => void }) => {
    if (!vote) return null;

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-xl border-4 border-gray-900 dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-indigo-600 p-3 border-b-4 border-gray-900 dark:border-black flex justify-between items-center">
                    <span className="font-bold text-white uppercase text-xs tracking-widest">Player Profile</span>
                    <button onClick={onClose}><X size={16} className="text-white hover:rotate-90 transition-transform"/></button>
                </div>

                <div className="p-6 text-center">
                    <div className="w-20 h-20 mx-auto rounded-lg bg-gray-100 dark:bg-slate-900 border-4 border-gray-300 dark:border-slate-600 mb-4 overflow-hidden relative">
                         {vote.user?.avatar ? <img src={vote.user.avatar} className="w-full h-full object-cover"/> : <div className="flex items-center justify-center h-full text-2xl font-black text-gray-400 dark:text-slate-700">{vote.user?.name?.[0]}</div>}
                         <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border border-black"></div>
                    </div>
                    
                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1 uppercase">{vote.user?.name}</h3>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400 mb-6 font-mono bg-gray-100 dark:bg-black/20 inline-block px-2 py-1 rounded">
                        LOG_ID: {vote.id.slice(0,8)}
                    </p>

                    <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 text-left border-2 border-gray-200 dark:border-slate-700 relative">
                        <div className="absolute -top-3 left-3 bg-white dark:bg-slate-800 px-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-gray-200 dark:border-slate-600 uppercase">
                            Action Chosen
                        </div>
                        <p className="text-sm font-bold text-gray-800 dark:text-emerald-400 leading-relaxed font-mono">
                            &gt; {vote.option?.text}
                        </p>
                    </div>

                    <div className="mt-6">
                        <GameButton onClick={onClose} variant="neutral" className="w-full">Close Dossier</GameButton>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// --- 3. CREATE QUEST MODAL (Updated Validation) ---
const CreateQuestModal = ({ isOpen, onClose, onSuccess, initialData }: any) => {
    const [question, setQuestion] = useState('');
    const [expiresInHours, setExpiresInHours] = useState('24');
    const [options, setOptions] = useState<Option[]>([
        { text: '', isCorrect: false }, { text: '', isCorrect: false },
        { text: '', isCorrect: false }, { text: '', isCorrect: false },
    ]);

    // 🔄 LOAD EQUIPPED DATA
    useEffect(() => {
        if (initialData) {
            setQuestion(initialData.question);
            if (initialData.options && initialData.options.length > 0) {
                const newOpts = initialData.options.map((o: any) => ({
                    text: o.text,
                    isCorrect: o.isCorrect || false
                }));
                // Fill up to 4 inputs for editing
                while (newOpts.length < 4) newOpts.push({ text: '', isCorrect: false });
                setOptions(newOpts);
            }
        }
    }, [initialData]);

    const generateMutation = useMutation({
        mutationFn: async () => client.post('/daily/generate', {}), 
        onSuccess: (res) => {
            const data = res.data;
            setQuestion(data.question);
            const newOpts = data.options.map((o: any) => ({
                text: o.text,
                isCorrect: o.isCorrect
            }));
            while (newOpts.length < 4) newOpts.push({ text: '', isCorrect: false });
            setOptions(newOpts);
            toast.success("✨ Summoned a random question from the Vault!");
        },
        onError: (err: any) => {
            if (err.response?.status === 404) {
                toast.warning("Vault is empty! Please create a question manually or import a file.");
            } else {
                toast.error("Failed to access Vault.");
            }
        }
    });

    const launchMutation = useMutation({
        mutationFn: async (payload: any) => client.post('/daily/create', payload),
        onSuccess: () => {
            onSuccess();
            toast.success("🚀 Quest Deployed!");
            setQuestion('');
            setOptions([{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }]);
            onClose();
        },
        onError: (err: any) => toast.error(err.response?.data?.message || "Launch failed")
    });

    // ✅ UPDATED VALIDATION LOGIC
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Filter out empty option texts
        const validOptions = options.filter(opt => opt.text.trim() !== "");

        // 2. Validate Question Text
        if (!question.trim()) {
            toast.warning("Please write a question.");
            return;
        }

        // 3. Validate Option Count (At least 1 required per your request)
        if (validOptions.length < 1) {
            toast.warning("You must provide at least one valid option.");
            return;
        }

        // 4. Validate Correct Answer (MANDATORY)
        const hasCorrectAnswer = validOptions.some(opt => opt.isCorrect);
        if (!hasCorrectAnswer) {
            toast.warning("Please mark one of the valid options as the correct answer.");
            return;
        }

        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + parseInt(expiresInHours));
        
        // 5. Submit only valid options
        launchMutation.mutate({ 
            question, 
            options: validOptions, 
            expiresAt: expiryDate.toISOString() 
        });
    };

    const handleOptionChange = (idx: number, val: string) => {
        const newOpts = [...options];
        newOpts[idx].text = val;
        setOptions(newOpts);
    };

    const handleCorrectSelect = (idx: number) => {
        const newOpts = options.map((o, i) => ({
            ...o,
            isCorrect: i === idx
        }));
        setOptions(newOpts);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-xl border-4 border-gray-900 dark:border-slate-500 shadow-[10px_10px_0px_0px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 bg-gray-100 dark:bg-slate-700 border-b-4 border-gray-300 dark:border-slate-600 flex justify-between items-center">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                        <Scroll size={20} className="text-indigo-600 dark:text-yellow-400" /> New Quest Scroll
                    </h2>
                    <button onClick={onClose} className="bg-red-500 hover:bg-red-400 text-white p-1 rounded border-2 border-red-800"><X size={16} /></button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Mission Objective (Question)</label>
                                <button 
                                    type="button"
                                    onClick={() => generateMutation.mutate()}
                                    disabled={generateMutation.isPending}
                                    className="text-[10px] bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded border-b-2 border-purple-800 flex items-center gap-2 active:border-b-0 active:translate-y-[2px]"
                                >
                                    {generateMutation.isPending ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}
                                    Random from Vault
                                </button>
                            </div>
                            <textarea 
                                value={question} 
                                onChange={(e) => setQuestion(e.target.value)} 
                                className="w-full bg-gray-50 dark:bg-slate-900 border-2 border-gray-300 dark:border-slate-600 rounded-lg p-3 text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none font-bold shadow-inner" 
                                placeholder="Enter the challenge here..." 
                                rows={3} 
                                autoFocus 
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {options.map((opt, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700/50 p-2 rounded-lg border border-gray-200 dark:border-slate-600">
                                    <button
                                        type="button"
                                        onClick={() => handleCorrectSelect(idx)}
                                        className={`shrink-0 w-8 h-8 rounded border-2 flex items-center justify-center transition-all ${
                                            opt.isCorrect 
                                            ? 'bg-green-500 border-green-700 text-white' 
                                            : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-600'
                                        }`}
                                        title="Mark Correct"
                                    >
                                        <CheckCircle2 size={16} />
                                    </button>
                                    <div className="flex-1">
                                        <input 
                                            type="text" 
                                            value={opt.text} 
                                            onChange={(e) => handleOptionChange(idx, e.target.value)} 
                                            className="w-full bg-transparent border-none text-gray-900 dark:text-white text-sm font-bold focus:ring-0 placeholder-gray-400 dark:placeholder-slate-500"
                                            placeholder={idx < 2 ? `Option ${idx + 1} (Required)` : `Option ${idx + 1} (Optional)`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t-2 border-gray-200 dark:border-slate-600 border-dashed">
                             <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-900 px-3 py-2 rounded border border-gray-300 dark:border-slate-700">
                                <Clock size={16} className="text-gray-500 dark:text-slate-400" />
                                <select value={expiresInHours} onChange={(e) => setExpiresInHours(e.target.value)} className="bg-transparent text-sm font-bold text-gray-900 dark:text-white outline-none cursor-pointer">
                                    <option value="4">4 Hours</option>
                                    <option value="8">8 Hours</option>
                                    <option value="24">24 Hours</option>
                                </select>
                             </div>
                             <GameButton type="submit" disabled={launchMutation.isPending} variant="success">
                                {launchMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <RocketIcon />}
                                Launch Quest
                             </GameButton>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

// --- 4. HISTORY MODAL ---
const HistoryModal = ({ isOpen, onClose, history }: any) => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 5;
    
    // Pagination Calculations
    const totalPages = Math.ceil((history?.length || 0) / ITEMS_PER_PAGE);
    const paginatedHistory = history?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => client.delete(`/daily/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quest-stats'] });
            toast.success("Log Deleted");
        }
    });

    const clearMutation = useMutation({
        mutationFn: async () => client.delete(`/daily/history/clear`),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['quest-stats'] });
            toast.success(res.data.message);
            onClose();
        }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-xl border-4 border-gray-900 dark:border-slate-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] flex flex-col max-h-[85vh]">
                <div className="p-4 border-b-4 border-gray-300 dark:border-slate-600 flex justify-between items-center bg-gray-100 dark:bg-slate-700">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase"><History size={20} /> Quest Archives</h2>
                    <div className="flex gap-2">
                        {history?.length > 0 && (
                            <button 
                                onClick={() => { if(confirm("NUKE HISTORY? This cannot be undone.")) clearMutation.mutate(); }}
                                className="bg-red-500 hover:bg-red-400 text-white px-3 py-1 rounded border-2 border-red-800 text-xs font-bold uppercase flex items-center gap-1"
                            >
                                <Skull size={14} /> Nuke Logs
                            </button>
                        )}
                        <button onClick={onClose}><X size={20} className="text-gray-500 dark:text-slate-300 hover:text-black dark:hover:text-white"/></button>
                    </div>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-3">
                    {paginatedHistory?.length > 0 ? paginatedHistory.map((h: any) => (
                        <div key={h.id} className="p-3 bg-gray-50 dark:bg-slate-900 border-l-4 border-purple-500 flex justify-between items-center group">
                            <div className="min-w-0 pr-2">
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{h.question}</p>
                                <span className="text-[10px] text-gray-500 dark:text-slate-400 font-mono">{new Date(h.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded text-xs font-bold border border-purple-500 shrink-0">{h._count.responses} Votes</span>
                                <button 
                                    onClick={() => { if(confirm("Delete this log?")) deleteMutation.mutate(h.id); }}
                                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-10 text-gray-500 dark:text-slate-500">No records found in the archives.</div>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="p-4 border-t-4 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 flex justify-between items-center">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 bg-white dark:bg-slate-700 rounded border-2 border-gray-300 dark:border-slate-600 disabled:opacity-50"><ChevronLeft size={16}/></button>
                        <span className="text-xs font-bold text-gray-600 dark:text-white uppercase tracking-widest">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 bg-white dark:bg-slate-700 rounded border-2 border-gray-300 dark:border-slate-600 disabled:opacity-50"><ChevronRight size={16}/></button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

// --- 5. VAULT MODAL (Only Document/AI Import now) ---
const VaultModal = ({ isOpen, onClose, onEquip }: any) => {
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    const { data: drafts, refetch: refetchDrafts } = useQuery({
        queryKey: ['quest-drafts'],
        queryFn: async () => { const res = await client.get('/daily/stats'); return res.data.drafts || []; },
        enabled: isOpen
    });

    const totalPages = Math.ceil((drafts?.length || 0) / ITEMS_PER_PAGE);
    const paginatedDrafts = drafts?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const aiFileMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            return client.post('/daily/import-ai', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        },
        onSuccess: (res) => { toast.success(res.data.message); refetchDrafts(); },
        onError: (err: any) => toast.error(err.response?.data?.message || "AI Extraction failed.")
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => client.delete(`/daily/${id}`),
        onSuccess: () => {
            refetchDrafts();
            toast.success("Draft Deleted");
        }
    });

    const clearMutation = useMutation({
        mutationFn: async () => client.delete(`/daily/vault/clear`),
        onSuccess: (res) => {
            refetchDrafts();
            toast.success(res.data.message);
        }
    });

    const handleAiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) aiFileMutation.mutate(file);
        e.target.value = ''; 
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-xl border-4 border-indigo-500 shadow-[0_0_0_4px_rgba(0,0,0,0.2)] dark:shadow-[0_0_0_4px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-4 bg-indigo-600 border-b-4 border-black flex justify-between items-center">
                    <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-widest"><Database size={20}/> Question Vault</h2>
                    <div className="flex gap-2">
                        {drafts?.length > 0 && (
                            <button 
                                onClick={() => { if(confirm("NUKE VAULT? All drafts will be lost.")) clearMutation.mutate(); }}
                                className="bg-red-500 hover:bg-red-400 text-white px-3 py-1 rounded border-2 border-red-800 text-xs font-bold uppercase flex items-center gap-1"
                            >
                                <Skull size={14} /> Nuke Vault
                            </button>
                        )}
                        <button onClick={onClose}><X size={20} className="text-white hover:text-red-200"/></button>
                    </div>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    <div className="space-y-4">
                        <div className="bg-indigo-50 dark:bg-slate-900 p-4 rounded border-2 border-indigo-200 dark:border-slate-700 border-dashed text-center">
                            {aiFileMutation.isPending ? (
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                                    <span className="text-xs text-indigo-600 dark:text-indigo-300 font-mono">DECODING SCROLL...</span>
                                </div>
                            ) : (
                                <label className="cursor-pointer block">
                                    <input type="file" accept=".pdf,.docx,.txt" onChange={handleAiFileUpload} className="hidden" />
                                    <Bot size={40} className="mx-auto text-indigo-500 dark:text-indigo-400 mb-2" />
                                    <p className="text-sm font-bold text-gray-800 dark:text-white">Magic File Reader</p>
                                    <p className="text-[10px] text-gray-500 dark:text-slate-500 uppercase mt-1">Upload PDF, DOCX, TXT to Extract Questions</p>
                                </label>
                            )}
                        </div>
                    </div>
                    
                    <div className="pt-4 border-t-2 border-gray-200 dark:border-slate-700">
                        <h3 className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-3">Stored Items ({drafts?.length || 0})</h3>
                        {paginatedDrafts?.length > 0 ? (
                            <div className="space-y-2">
                                {paginatedDrafts.map((q: any) => (
                                    <div key={q.id} className="p-3 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 flex justify-between items-center group">
                                        <p className="text-xs text-gray-800 dark:text-white font-bold truncate max-w-md">{q.question}</p>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => onEquip(q)} 
                                                className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded border border-indigo-800 uppercase font-bold transition-all active:translate-y-0.5"
                                            >
                                                Equip
                                            </button>
                                            <button 
                                                onClick={() => { if(confirm("Delete this draft?")) deleteMutation.mutate(q.id); }}
                                                className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <div className="text-center text-gray-400 dark:text-slate-500 text-xs italic">Vault is empty.</div>}
                    </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="p-4 border-t-4 border-indigo-200 dark:border-slate-700 bg-indigo-50 dark:bg-slate-900 flex justify-between items-center">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 bg-white dark:bg-slate-700 rounded border-2 border-indigo-200 dark:border-slate-600 disabled:opacity-50"><ChevronLeft size={16}/></button>
                        <span className="text-xs font-bold text-indigo-700 dark:text-white uppercase tracking-widest">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 bg-white dark:bg-slate-700 rounded border-2 border-indigo-200 dark:border-slate-600 disabled:opacity-50"><ChevronRight size={16}/></button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

// --- 6. LEADERBOARD MODAL ---
const LeaderboardModal = ({ isOpen, onClose }: any) => {
    const { data: leaders } = useQuery({
        queryKey: ['leaderboard'],
        queryFn: async () => (await client.get('/daily/leaderboard')).data,
        enabled: isOpen
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1070] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-md rounded-xl border-4 border-yellow-500 shadow-[0_0_0_4px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[85vh]">
                
                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-yellow-500 to-orange-500 border-b-4 border-black flex justify-between items-center">
                    <h2 className="text-xl font-black text-black flex items-center gap-2 uppercase tracking-widest">
                        <Trophy size={20} fill="black" /> Hall of Fame
                    </h2>
                    <button onClick={onClose}><X size={20} className="text-black hover:text-white"/></button>
                </div>

                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-gray-50 dark:bg-slate-900">
                    <div className="space-y-3">
                        {leaders?.map((user: any, index: number) => {
                            let rankStyle = "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700";
                            let rankIcon = <span className="font-mono font-bold text-gray-500">#{index + 1}</span>;

                            if (index === 0) {
                                rankStyle = "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 shadow-md";
                                rankIcon = <Crown size={20} className="text-yellow-600 dark:text-yellow-400" fill="currentColor" />;
                            } else if (index === 1) {
                                rankStyle = "bg-gray-50 dark:bg-slate-800 border-gray-400";
                                rankIcon = <Medal size={20} className="text-gray-400" fill="currentColor" />;
                            } else if (index === 2) {
                                rankStyle = "bg-orange-50 dark:bg-orange-900/10 border-orange-400";
                                rankIcon = <Medal size={20} className="text-orange-500" fill="currentColor" />;
                            }

                            return (
                                <div key={user.id} className={`flex items-center gap-3 p-3 rounded-lg border-2 ${rankStyle} transition-transform hover:scale-[1.02]`}>
                                    <div className="w-8 flex justify-center">{rankIcon}</div>
                                    
                                    <div className="w-10 h-10 rounded bg-gray-200 dark:bg-black border-2 border-gray-300 dark:border-slate-600 flex items-center justify-center overflow-hidden">
                                        {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <span className="font-bold text-gray-500 dark:text-slate-500">{user.name[0]}</span>}
                                    </div>

                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-bold text-orange-500 flex items-center gap-0.5"><Flame size={10} fill="currentColor"/> {user.streak} Streak</span>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <span className="block text-lg font-black text-indigo-600 dark:text-indigo-400">{user.score}</span>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase">PTS</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// Helper Icon
const RocketIcon = () => <Send size={16} className="-rotate-45 mb-1" />

// --- MAIN PAGE ---
const AdminDailyQuest = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false); // ✅ Leaderboard State
  const [selectedVote, setSelectedVote] = useState<any>(null);
  
  // ✅ STATE: Holds question to equip from Vault
  const [draftToEquip, setDraftToEquip] = useState<any>(null);

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
      toast.info("Quest complete. XP Awarded.");
    }
  });

  const refreshData = () => {
      queryClient.invalidateQueries({ queryKey: ['quest-stats'] });
      queryClient.invalidateQueries({ queryKey: ['active-question'] }); // 👈 Force the Robot to appear
  };

  // ✅ HANDLER: Equip Question
  const handleEquip = (questionData: any) => {
      setDraftToEquip(questionData);
      setIsVaultOpen(false); // Close Vault
      setIsCreateOpen(true); // Open Creator
  };

  // ✅ HANDLER: Clear Draft on Close
  const handleCreateClose = () => {
      setIsCreateOpen(false);
      setDraftToEquip(null);
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-8 font-sans text-gray-900 dark:text-slate-100 transition-colors duration-500">
      {/* Grid Pattern Background */}
      <div className="fixed inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
                <button onClick={() => navigate(-1)} className="group flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors text-xs font-bold uppercase tracking-widest mb-2">
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Exit to Dashboard
                </button>
                <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white uppercase drop-shadow-[2px_2px_0px_#cbd5e1] dark:drop-shadow-[2px_2px_0px_#4f46e5]">
                    Quest Command
                </h1>
            </div>
            <div className="flex gap-4">
                {/* ✅ Leaderboard Button Added */}
                <GameButton onClick={() => setIsLeaderboardOpen(true)} variant="gold">
                    <Trophy size={16} /> Rankings
                </GameButton>
                <GameButton onClick={() => setIsVaultOpen(true)} variant="neutral">
                    <Database size={16} /> Vault
                </GameButton>
                <GameButton onClick={() => setIsHistoryOpen(true)} variant="neutral">
                    <History size={16} /> Logs
                </GameButton>
                <GameButton onClick={() => setIsCreateOpen(true)} variant="primary">
                    <Plus size={16} /> New Quest
                </GameButton>
            </div>
        </div>

        {/* --- MAIN GRID --- */}
        {activeQuest ? (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                
                {/* 1. LEFT: ACTIVE QUEST SCREEN */}
                <div className="xl:col-span-7 flex flex-col gap-6">
                    <GameCard className="p-8 relative overflow-hidden min-h-[500px] flex flex-col bg-gray-100 dark:bg-slate-800">
                        
                        {/* Status Bar */}
                        <div className="flex justify-between items-start mb-8 border-b-2 border-gray-300 dark:border-slate-700 pb-4">
                             <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute"></span>
                                    <span className="w-3 h-3 bg-red-500 rounded-full relative"></span>
                                    <span className="font-bold text-red-600 dark:text-red-400 uppercase tracking-widest text-xs">Live Broadcast</span>
                                </div>
                                <CountdownTimer expiresAt={activeQuest.expiresAt} />
                             </div>
                             <button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending} className="bg-gray-200 dark:bg-slate-900 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-2 rounded border border-gray-300 dark:border-slate-700 transition-colors" title="Abort Mission">
                                <StopCircle size={24} />
                             </button>
                        </div>

                        {/* Question */}
                        <h2 className="text-2xl md:text-3xl font-black leading-tight mb-8 text-gray-900 dark:text-white">
                            {activeQuest.question}
                        </h2>

                        {/* Results Bars (Health Bars Style) */}
                        <div className="space-y-5 flex-1">
                            {activeQuest.options.map((opt: any) => {
                                const count = activeQuest.responses?.filter((r: any) => r.optionId === opt.id).length || 0;
                                const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                                const isWinner = pct > 0 && pct === Math.max(...activeQuest.options.map((o: any) => {
                                    const c = activeQuest.responses?.filter((r: any) => r.optionId === o.id).length || 0;
                                    return totalVotes > 0 ? (c / totalVotes) * 100 : 0;
                                }));

                                return (
                                    <div key={opt.id} className="relative">
                                        <div className="flex justify-between text-xs font-bold mb-1 z-10 relative">
                                            <span className="text-gray-600 dark:text-slate-300 uppercase">{opt.text}</span>
                                            <span className="text-gray-900 dark:text-white">{Math.round(pct)}%</span>
                                        </div>
                                        <div className="h-5 w-full bg-gray-200 dark:bg-slate-900 border-2 border-gray-300 dark:border-slate-700 rounded-none overflow-hidden relative">
                                            <motion.div 
                                                initial={{ width: 0 }} 
                                                animate={{ width: `${pct}%` }} 
                                                transition={{ duration: 1, ease: "circOut" }} 
                                                className={`h-full ${isWinner ? 'bg-green-500' : 'bg-indigo-500'}`} 
                                            />
                                            {/* Grid overlay on bar */}
                                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer Stats */}
                        <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t-2 border-gray-300 dark:border-slate-700">
                             <div className="bg-white dark:bg-slate-900 p-3 rounded border border-gray-300 dark:border-slate-700 text-center">
                                 <div className="text-2xl font-black text-gray-900 dark:text-white">{totalVotes}</div>
                                 <div className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest">Active Units</div>
                             </div>
                             <div className="bg-white dark:bg-slate-900 p-3 rounded border border-gray-300 dark:border-slate-700 text-center opacity-60">
                                 <div className="text-2xl font-black text-gray-400 dark:text-slate-400">{pendingVotes}</div>
                                 <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Offline</div>
                             </div>
                        </div>
                    </GameCard>
                </div>

                {/* 2. RIGHT: VOTER LOG (Data Terminal) */}
                <div className="xl:col-span-5">
                    <GameCard className="flex flex-col h-full min-h-[600px] overflow-hidden bg-gray-50 dark:bg-black">
                        <div className="p-4 border-b-4 border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 flex justify-between items-center">
                             <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                                <Swords size={16} className="text-orange-500" /> Battle Log
                             </h3>
                             <span className="bg-white dark:bg-slate-900 px-2 py-1 text-[10px] font-mono text-green-600 dark:text-green-400 border border-gray-300 dark:border-slate-700 rounded">
                                LIVE
                             </span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {activeQuest.responses?.length > 0 ? (
                                <>
                                    {activeQuest.responses.map((resp: any) => (
                                        <div 
                                            key={resp.id} 
                                            onClick={() => setSelectedVote(resp)}
                                            className="group flex items-center justify-between p-3 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 border-l-4 border-gray-300 dark:border-slate-700 hover:border-indigo-500 transition-all cursor-pointer shadow-sm"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-700 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-xs rounded-sm overflow-hidden">
                                                    {/* ✅ FIXED AVATAR RENDERING */}
                                                    {resp.user?.avatar ? (
                                                        <img src={resp.user.avatar} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span>{resp.user?.name?.[0]}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-xs text-gray-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-white uppercase">{resp.user?.name || 'Unknown'}</div>
                                                    <div className="text-[9px] text-gray-500 dark:text-slate-500 font-mono group-hover:text-indigo-500 dark:group-hover:text-indigo-400">
                                                        &gt; View Data
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                 <span className="text-[9px] font-mono text-gray-400 dark:text-slate-600 block">{new Date(resp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-slate-700">
                                    <Skull size={40} className="mb-2 opacity-50" />
                                    <span className="text-xs font-bold uppercase tracking-widest">No Signals Detected</span>
                                </div>
                            )}
                        </div>
                    </GameCard>
                </div>

            </div>
        ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="w-32 h-32 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-8 border-4 border-gray-300 dark:border-slate-700 shadow-xl">
                    <Swords size={40} className="text-gray-400 dark:text-slate-500" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tighter">System Offline</h2>
                <p className="text-gray-500 dark:text-slate-400 max-w-md mb-8 text-sm font-mono">No active quest found. Initialize new protocol to engage units.</p>
                <GameButton onClick={() => setIsCreateOpen(true)} variant="primary" className="text-lg px-8 py-4">
                    <Plus size={20} /> Initialize Quest
                </GameButton>
            </div>
        )}

        {/* MODALS */}
        {/* ✅ Pass initialData to Create Modal */}
        <CreateQuestModal 
            isOpen={isCreateOpen} 
            onClose={handleCreateClose} 
            onSuccess={refreshData} 
            initialData={draftToEquip} 
        />
        <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={data?.history} />
        
        {/* ✅ Pass onEquip Handler to Vault */}
        <VaultModal 
            isOpen={isVaultOpen} 
            onClose={() => setIsVaultOpen(false)} 
            onEquip={handleEquip} 
        />
        
        <LeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} />
        {selectedVote && <VoteDetailModal vote={selectedVote} onClose={() => setSelectedVote(null)} />}

      </div>
    </div>
  );
};

export default AdminDailyQuest;