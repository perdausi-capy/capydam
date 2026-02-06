import { useState } from 'react';
import { motion } from 'framer-motion';
import { History, Skull, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import client from '../../../api/client';
import { toast } from 'react-toastify';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const HistoryModal = ({ isOpen, onClose, history }: any) => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 5;
    
    const totalPages = Math.ceil((history?.length || 0) / ITEMS_PER_PAGE);
    const paginatedHistory = history?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => client.delete(`/daily/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['quest-stats'] }); toast.success("Log Deleted"); }
    });

    const clearMutation = useMutation({
        mutationFn: async () => client.delete(`/daily/history/clear`),
        onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['quest-stats'] }); toast.success(res.data.message); onClose(); }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-xl border-4 border-gray-900 dark:border-slate-500 shadow-xl flex flex-col max-h-[85vh]">
                <div className="p-4 border-b-4 border-gray-300 dark:border-slate-600 flex justify-between items-center bg-gray-100 dark:bg-slate-700">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase"><History size={20} /> Quest Archives</h2>
                    <div className="flex gap-2">
                        {history?.length > 0 && (
                            <button onClick={() => { if(confirm("NUKE HISTORY?")) clearMutation.mutate(); }} className="bg-red-500 hover:bg-red-400 text-white px-3 py-1 rounded border-2 border-red-800 text-xs font-bold uppercase flex items-center gap-1">
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
                                <button onClick={() => { if(confirm("Delete log?")) deleteMutation.mutate(h.id); }} className="text-gray-400 hover:text-red-500 transition-colors p-1"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    )) : <div className="text-center py-10 text-gray-500 dark:text-slate-500">No records found.</div>}
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