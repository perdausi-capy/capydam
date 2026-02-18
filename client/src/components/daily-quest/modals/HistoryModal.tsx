import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    History, Skull, X, Trash2, ChevronLeft, ChevronRight, 
    Search, ArrowUpDown, Calendar, Users, CheckCircle2, XCircle, ArrowLeft,
    RefreshCw 
} from 'lucide-react';
import client from '../../../api/client';
import { toast } from 'react-toastify';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// --- SUB-COMPONENT: DRILL DOWN VIEW (NOW WITH PAGINATION) ---
const QuestDetailView = ({ questId, onBack }: { questId: string, onBack: () => void }) => {
    // Internal state for pagination within the details view
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 5; 

    const { data: quest, isLoading } = useQuery({
        queryKey: ['quest-detail', questId],
        queryFn: async () => (await client.get(`/daily/${questId}/details`)).data
    });

    if (isLoading) return <div className="p-10 text-center text-gray-500">Loading Report...</div>;
    if (!quest) return <div className="p-10 text-center text-red-500">Data not found.</div>;

    const totalVotes = quest.responses.length;
    const correctVotes = quest.responses.filter((r: any) => r.option.isCorrect).length;
    const winRate = totalVotes > 0 ? Math.round((correctVotes / totalVotes) * 100) : 0;

    // Pagination Logic
    const totalPages = Math.ceil(totalVotes / ITEMS_PER_PAGE);
    const paginatedResponses = quest.responses.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    return (
        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex items-center gap-3 shrink-0">
                <button onClick={onBack} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-slate-600">
                    <ArrowLeft size={18} className="text-gray-500 dark:text-slate-400" />
                </button>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{quest.question}</h3>
                    <p className="text-[10px] text-gray-500 dark:text-slate-500 font-mono">
                        {new Date(quest.createdAt).toLocaleDateString()} • {new Date(quest.createdAt).toLocaleTimeString()}
                    </p>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-bold border ${winRate >= 50 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                    {winRate}% Correct
                </div>
            </div>

            {/* List Content (Paginated) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                {paginatedResponses.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">No brave souls attempted this quest.</div>
                ) : (
                    paginatedResponses.map((resp: any) => (
                        <div key={resp.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden shrink-0">
                                    {resp.user?.avatar ? <img src={resp.user.avatar} className="w-full h-full object-cover" alt="avatar"/> : <div className="flex items-center justify-center h-full font-bold text-xs text-gray-500">{resp.user?.name?.[0]}</div>}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-gray-800 dark:text-white truncate">{resp.user?.name}</p>
                                    <p className="text-[10px] text-gray-400 truncate">{resp.option.text}</p>
                                </div>
                            </div>
                            <div className="shrink-0">
                                {resp.option.isCorrect ? (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full"><CheckCircle2 size={12} /> +10 XP</span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full"><XCircle size={12} /> Failed</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
                <div className="p-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex justify-between items-center shrink-0">
                    <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))} 
                        disabled={page === 1} 
                        className="p-1.5 bg-white dark:bg-slate-800 rounded border border-gray-300 dark:border-slate-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                        <ChevronLeft size={16} className="text-gray-600 dark:text-slate-300"/>
                    </button>
                    <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400">
                        Page {page} of {totalPages}
                    </span>
                    <button 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                        disabled={page === totalPages} 
                        className="p-1.5 bg-white dark:bg-slate-800 rounded border border-gray-300 dark:border-slate-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                        <ChevronRight size={16} className="text-gray-600 dark:text-slate-300"/>
                    </button>
                </div>
            )}
        </motion.div>
    );
};


// --- MAIN MODAL ---
export const HistoryModal = ({ isOpen, onClose, history }: any) => {
    const queryClient = useQueryClient();
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [sortDesc, setSortDesc] = useState(true);

    const ITEMS_PER_PAGE = 6;

    const filteredHistory = useMemo(() => {
        if (!history) return [];
        let data = [...history];
        if (search) data = data.filter(h => h.question.toLowerCase().includes(search.toLowerCase()));
        data.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortDesc ? dateB - dateA : dateA - dateB;
        });
        return data;
    }, [history, search, sortDesc]);

    const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
    const paginatedData = filteredHistory.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    // --- MUTATIONS ---
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => client.delete(`/daily/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['quest-stats'] }); toast.success("Log Deleted"); }
    });

    const clearMutation = useMutation({
        mutationFn: async () => client.delete(`/daily/history/clear`),
        onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['quest-stats'] }); toast.success(res.data.message); onClose(); }
    });

    // Recycle All History Mutation
    const recycleAllMutation = useMutation({
        mutationFn: async () => client.post(`/daily/recycle-all`),
        onSuccess: (res) => { 
            queryClient.invalidateQueries({ queryKey: ['quest-stats'] }); 
            toast.success(res.data.message); 
            onClose(); 
        }
    });

    // Recycle Single Quest Mutation
    const recycleSingleMutation = useMutation({
        mutationFn: async (id: string) => client.post(`/daily/recycle/${id}`),
        onSuccess: (res) => { 
            queryClient.invalidateQueries({ queryKey: ['quest-stats'] }); 
            toast.success(res.data.message); 
        }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-xl border-4 border-gray-900 dark:border-slate-500 shadow-xl flex flex-col h-[600px] overflow-hidden">
                
                {/* Header */}
                <div className="p-4 border-b-4 border-gray-300 dark:border-slate-600 flex justify-between items-center bg-gray-100 dark:bg-slate-700 shrink-0">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase">
                        <History size={20} className="text-purple-600 dark:text-purple-400"/> Quest Archives
                    </h2>
                    <div className="flex gap-2">
                        {view === 'list' && history?.length > 0 && (
                            <>
                                <button 
                                    onClick={() => { if(confirm("Move all history back to Vault?")) recycleAllMutation.mutate(); }} 
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded border-2 border-purple-800 text-xs font-bold uppercase flex items-center gap-1"
                                >
                                    <RefreshCw size={14} className={recycleAllMutation.isPending ? "animate-spin" : ""} /> Recycle All
                                </button>
                                
                                <button onClick={() => { if(confirm("NUKE HISTORY?")) clearMutation.mutate(); }} className="bg-red-500 hover:bg-red-400 text-white px-3 py-1 rounded border-2 border-red-800 text-xs font-bold uppercase flex items-center gap-1">
                                    <Skull size={14} /> Nuke Logs
                                </button>
                            </>
                        )}
                        <button onClick={onClose}><X size={20} className="text-gray-500 dark:text-slate-300 hover:text-black dark:hover:text-white"/></button>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {view === 'list' ? (
                        <motion.div 
                            key="list"
                            initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
                            className="flex flex-col h-full overflow-hidden"
                        >
                            {/* Toolbar */}
                            <div className="p-3 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 flex gap-2">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                    <input 
                                        type="text" 
                                        placeholder="Search quests..." 
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-medium focus:outline-none focus:border-purple-500 dark:text-white"
                                    />
                                </div>
                                <button 
                                    onClick={() => setSortDesc(!sortDesc)}
                                    className="px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                >
                                    <ArrowUpDown size={14} />
                                </button>
                            </div>

                            {/* Main List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                                {paginatedData?.length > 0 ? paginatedData.map((h: any) => (
                                    <div 
                                        key={h.id} 
                                        onClick={() => { setSelectedQuestId(h.id); setView('detail'); }}
                                        className="p-3 bg-gray-50 dark:bg-slate-900 border-l-4 border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10 cursor-pointer transition-colors flex justify-between items-center group rounded-r-lg"
                                    >
                                        <div className="min-w-0 pr-2">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{h.question}</p>
                                            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 dark:text-slate-400 font-mono">
                                                <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(h.createdAt).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1"><Users size={10} /> {h._count.responses} Participants</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {/* RECYCLE SINGLE */}
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    if(confirm("Recycle this quest back to Vault?")) recycleSingleMutation.mutate(h.id); 
                                                }} 
                                                title="Recycle to Vault"
                                                className="text-gray-300 hover:text-purple-500 transition-colors p-2"
                                            >
                                                <RefreshCw size={14} />
                                            </button>

                                            <button onClick={(e) => { e.stopPropagation(); if(confirm("Delete log?")) deleteMutation.mutate(h.id); }} className="text-gray-300 hover:text-red-500 transition-colors p-2">
                                                <Trash2 size={14} />
                                            </button>
                                            <ChevronRight size={14} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                )) : <div className="text-center py-20 text-gray-500 dark:text-slate-500 text-sm">No records found.</div>}
                            </div>

                            {/* Main Pagination */}
                            {totalPages > 1 && (
                                <div className="p-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex justify-between items-center shrink-0">
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 bg-white dark:bg-slate-800 rounded border border-gray-300 dark:border-slate-600 disabled:opacity-50"><ChevronLeft size={16}/></button>
                                    <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400">Page {page} of {totalPages}</span>
                                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 bg-white dark:bg-slate-800 rounded border border-gray-300 dark:border-slate-600 disabled:opacity-50"><ChevronRight size={16}/></button>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <QuestDetailView 
                            key="detail" 
                            questId={selectedQuestId!} 
                            onBack={() => setView('list')} 
                        />
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};