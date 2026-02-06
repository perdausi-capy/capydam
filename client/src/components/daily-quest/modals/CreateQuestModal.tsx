import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Scroll, Loader2, Wand2, CheckCircle2, Clock, Calendar, Send } from 'lucide-react';
import client from '../../../api/client';
import { toast } from 'react-toastify';
import { useMutation } from '@tanstack/react-query';
import { GameButton } from '../ui/GameButton';

const RocketIcon = () => <Send size={16} className="-rotate-45 mb-1" />;

export const CreateQuestModal = ({ isOpen, onClose, onSuccess, initialData }: any) => {
    const [question, setQuestion] = useState('');
    const [expiresInHours, setExpiresInHours] = useState('24');
    const [scheduleDate, setScheduleDate] = useState(''); 
    const [isScheduled, setIsScheduled] = useState(false);
    const [options, setOptions] = useState([
        { text: '', isCorrect: false }, { text: '', isCorrect: false },
        { text: '', isCorrect: false }, { text: '', isCorrect: false },
    ]);

    useEffect(() => {
        if (initialData) {
            setQuestion(initialData.question);
            if (initialData.options?.length > 0) {
                const newOpts = initialData.options.map((o: any) => ({
                    text: o.text,
                    isCorrect: o.isCorrect || false
                }));
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
            const newOpts = data.options.map((o: any) => ({ text: o.text, isCorrect: o.isCorrect }));
            while (newOpts.length < 4) newOpts.push({ text: '', isCorrect: false });
            setOptions(newOpts);
            toast.success("✨ Summoned a random question!");
        },
        onError: (err: any) => {
            if (err.response?.status === 404) toast.warning("Vault is empty!");
            else toast.error("Failed to access Vault.");
        }
    });

    const launchMutation = useMutation({
        mutationFn: async (payload: any) => client.post('/daily/create', payload),
        onSuccess: () => {
            onSuccess();
            toast.success(isScheduled ? "📅 Scheduled Successfully!" : "🚀 Quest Deployed!");
            setQuestion('');
            setOptions([{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }]);
            setIsScheduled(false);
            setScheduleDate('');
            onClose();
        },
        onError: (err: any) => toast.error(err.response?.data?.message || "Launch failed")
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validOptions = options.filter(opt => opt.text.trim() !== "");
        if (!question.trim()) { toast.warning("Please write a question."); return; }
        if (validOptions.length < 1) { toast.warning("Provide at least one option."); return; }
        if (!validOptions.some(opt => opt.isCorrect)) { toast.warning("Mark a correct answer."); return; }

        let payload: any = { question, options: validOptions };

        if (isScheduled && scheduleDate) {
            payload.scheduledFor = new Date(scheduleDate).toISOString();
        } else {
            const expiryDate = new Date();
            expiryDate.setHours(expiryDate.getHours() + parseInt(expiresInHours));
            payload.expiresAt = expiryDate.toISOString();
        }
        launchMutation.mutate(payload);
    };

    const handleOptionChange = (idx: number, val: string) => {
        const newOpts = [...options];
        newOpts[idx].text = val;
        setOptions(newOpts);
    };

    const handleCorrectSelect = (idx: number) => {
        const newOpts = options.map((o, i) => ({ ...o, isCorrect: i === idx }));
        setOptions(newOpts);
    };

    const setTomorrow9AM = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        const localIso = new Date(tomorrow.getTime() - (tomorrow.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setScheduleDate(localIso);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-xl border-4 border-gray-900 dark:border-slate-500 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
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
                                <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Mission Objective</label>
                                <button type="button" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="text-[10px] bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded border-b-2 border-purple-800 flex items-center gap-2 active:border-b-0 active:translate-y-[2px]">
                                    {generateMutation.isPending ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />} Random from Vault
                                </button>
                            </div>
                            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-900 border-2 border-gray-300 dark:border-slate-600 rounded-lg p-3 text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none font-bold shadow-inner" placeholder="Enter the challenge here..." rows={3} autoFocus />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {options.map((opt, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700/50 p-2 rounded-lg border border-gray-200 dark:border-slate-600">
                                    <button type="button" onClick={() => handleCorrectSelect(idx)} className={`shrink-0 w-8 h-8 rounded border-2 flex items-center justify-center transition-all ${opt.isCorrect ? 'bg-green-500 border-green-700 text-white' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-600'}`} title="Mark Correct"><CheckCircle2 size={16} /></button>
                                    <input type="text" value={opt.text} onChange={(e) => handleOptionChange(idx, e.target.value)} className="w-full bg-transparent border-none text-gray-900 dark:text-white text-sm font-bold focus:ring-0 placeholder-gray-400 dark:placeholder-slate-500" placeholder={`Option ${idx + 1}`} />
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-4 pt-4 border-t-2 border-gray-200 dark:border-slate-600 border-dashed">
                             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`w-10 h-5 rounded-full relative transition-colors border ${isScheduled ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-300 dark:bg-slate-600 border-gray-400 dark:border-slate-500'}`}>
                                        <input type="checkbox" className="hidden" checked={isScheduled} onChange={(e) => { setIsScheduled(e.target.checked); if (e.target.checked && !scheduleDate) setTomorrow9AM(); }} />
                                        <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform shadow-sm ${isScheduled ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide group-hover:text-indigo-500 transition-colors">Schedule for Later</span>
                                </label>

                                {isScheduled ? (
                                    <input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded px-3 py-1.5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-indigo-500" />
                                ) : (
                                     <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-900 px-3 py-1.5 rounded border border-gray-300 dark:border-slate-700">
                                        <Clock size={14} className="text-gray-500 dark:text-slate-400" />
                                        <select value={expiresInHours} onChange={(e) => setExpiresInHours(e.target.value)} className="bg-transparent text-xs font-bold text-gray-900 dark:text-white outline-none cursor-pointer">
                                            <option value="4">4 Hours</option>
                                            <option value="8">8 Hours</option>
                                            <option value="24">24 Hours</option>
                                        </select>
                                     </div>
                                )}
                             </div>
                             <GameButton type="submit" disabled={launchMutation.isPending || (isScheduled && !scheduleDate)} variant={isScheduled ? "neutral" : "success"}>
                                {launchMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : (isScheduled ? <Calendar size={16} /> : <RocketIcon />)}
                                {isScheduled ? "Save Schedule" : "Launch Now"}
                             </GameButton>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};