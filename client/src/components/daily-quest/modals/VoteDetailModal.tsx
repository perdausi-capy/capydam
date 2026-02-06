
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { GameButton } from '../ui/GameButton';

export const VoteDetailModal = ({ vote, onClose }: { vote: any, onClose: () => void }) => {
    if (!vote) return null;
    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-xl border-4 border-gray-900 dark:border-white shadow-xl" onClick={(e) => e.stopPropagation()}>
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
                    <p className="text-[10px] text-gray-500 dark:text-slate-400 mb-6 font-mono bg-gray-100 dark:bg-black/20 inline-block px-2 py-1 rounded">LOG_ID: {vote.id.slice(0,8)}</p>
                    <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 text-left border-2 border-gray-200 dark:border-slate-700 relative">
                        <div className="absolute -top-3 left-3 bg-white dark:bg-slate-800 px-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-gray-200 dark:border-slate-600 uppercase">Action Chosen</div>
                        <p className="text-sm font-bold text-gray-800 dark:text-emerald-400 leading-relaxed font-mono">&gt; {vote.option?.text}</p>
                    </div>
                    <div className="mt-6"><GameButton onClick={onClose} variant="neutral" className="w-full">Close Dossier</GameButton></div>
                </div>
            </motion.div>
        </div>
    );
};