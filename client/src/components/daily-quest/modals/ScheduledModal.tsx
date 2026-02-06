import { motion } from 'framer-motion';
import { X, CalendarClock, XCircle } from 'lucide-react';
import client from '../../../api/client';
import { toast } from 'react-toastify';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const ScheduledModal = ({ isOpen, onClose, scheduled }: any) => {
    const queryClient = useQueryClient();

    const unscheduleMutation = useMutation({
        mutationFn: async (id: string) => client.patch(`/daily/${id}/unschedule`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quest-stats'] });
            toast.success("Task Cancelled (Moved to Vault)");
        },
        onError: () => toast.error("Failed to cancel task")
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1080] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-xl border-4 border-indigo-500 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-4 bg-indigo-100 dark:bg-slate-700 border-b-4 border-indigo-200 dark:border-slate-600 flex justify-between items-center">
                    <h2 className="text-lg font-black text-indigo-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                        <CalendarClock size={20} /> Scheduled Queue
                    </h2>
                    <button onClick={onClose}><X size={20} className="text-gray-500 dark:text-slate-300 hover:text-black dark:hover:text-white"/></button>
                </div>
                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                    {scheduled?.length > 0 ? (
                        scheduled.map((task: any) => (
                            <div key={task.id} className="p-4 bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-slate-600 rounded-xl flex justify-between items-center group">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-700 uppercase tracking-wide">
                                            {new Date(task.scheduledFor).toLocaleDateString()}
                                        </span>
                                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500">
                                            {new Date(task.scheduledFor).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">{task.question}</h4>
                                </div>
                                <button onClick={() => { if(confirm("Cancel this schedule?")) unscheduleMutation.mutate(task.id) }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Cancel Schedule">
                                    <XCircle size={20} />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 text-gray-400 dark:text-slate-500 flex flex-col items-center">
                            <CalendarClock size={48} className="mb-3 opacity-20" />
                            <p className="text-sm">No missions scheduled.</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};