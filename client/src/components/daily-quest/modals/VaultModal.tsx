import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Skull, X, Loader2, Bot, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import client from '../../../api/client';
import { toast } from 'react-toastify';
import { useQuery, useMutation } from '@tanstack/react-query';

export const VaultModal = ({ isOpen, onClose, onEquip }: any) => {
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
        onSuccess: () => { refetchDrafts(); toast.success("Draft Deleted"); }
    });

    const clearMutation = useMutation({
        mutationFn: async () => client.delete(`/daily/vault/clear`),
        onSuccess: (res) => { refetchDrafts(); toast.success(res.data.message); }
    });

    const handleAiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) aiFileMutation.mutate(file);
        e.target.value = ''; 
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-xl border-4 border-indigo-500 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-4 bg-indigo-600 border-b-4 border-black flex justify-between items-center">
                    <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-widest"><Database size={20}/> Question Vault</h2>
                    <div className="flex gap-2">
                        {drafts?.length > 0 && (
                            <button onClick={() => { if(confirm("NUKE VAULT?")) clearMutation.mutate(); }} className="bg-red-500 hover:bg-red-400 text-white px-3 py-1 rounded border-2 border-red-800 text-xs font-bold uppercase flex items-center gap-1">
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
                                <div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin text-indigo-500" size={32} /><span className="text-xs text-indigo-600 dark:text-indigo-300 font-mono">DECODING SCROLL...</span></div>
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
                                            <button onClick={() => onEquip(q)} className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded border border-indigo-800 uppercase font-bold transition-all active:translate-y-0.5">Equip</button>
                                            <button onClick={() => { if(confirm("Delete draft?")) deleteMutation.mutate(q.id); }} className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <div className="text-center text-gray-400 dark:text-slate-500 text-xs italic">Vault is empty.</div>}
                    </div>
                </div>
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