import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Scroll, Loader2, Wand2, CheckCircle2, Archive, Send } from 'lucide-react';
import client from '../../../api/client';
import { toast } from 'react-toastify';
import { useMutation } from '@tanstack/react-query';
import { GameButton } from '../ui/GameButton';

export const CreateQuestModal = ({ isOpen, onClose, onSuccess, initialData }: any) => {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState([
        { text: '', isCorrect: false }, 
        { text: '', isCorrect: false },
        { text: '', isCorrect: false }, 
        { text: '', isCorrect: false },
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
            toast.success("Quest Saved!");
            setQuestion('');
            setOptions([{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }]);
            onClose();
        },
        onError: (err: any) => toast.error(err.response?.data?.message || "Action failed")
    });

    // 1. SAVE TO VAULT (Draft)
    const handleSaveToVault = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        // We send a dummy scheduledFor date to trick the backend into creating it as "inactive" (Draft)
        const payloadDraft = {
            question,
            options: options.filter(o => o.text.trim()),
            scheduledFor: new Date().toISOString() 
        };
        launchMutation.mutate(payloadDraft);
    };

    // 2. LAUNCH NOW (Manual Override)
    const handleLaunchNow = () => {
        if (!validateForm()) return;
        
        const payload = {
            question,
            options: options.filter(o => o.text.trim()),
            // No scheduledFor = Launch Immediate (isActive: true)
        };
        launchMutation.mutate(payload);
    };

    const validateForm = () => {
        const validOptions = options.filter(opt => opt.text.trim() !== "");
        if (!question.trim()) { toast.warning("Please write a question."); return false; }
        if (validOptions.length < 1) { toast.warning("Provide at least one option."); return false; }
        if (!validOptions.some(opt => opt.isCorrect)) { toast.warning("Mark a correct answer."); return false; }
        return true;
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
                    <div className="space-y-6">
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

                        {/* ACTION BUTTONS */}
                        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t-2 border-gray-200 dark:border-slate-600 border-dashed">
                             <GameButton 
                                onClick={handleSaveToVault} 
                                disabled={launchMutation.isPending} 
                                variant="neutral"
                                className="flex-1"
                             >
                                <Archive size={16} /> Save to Vault
                             </GameButton>

                             <GameButton 
                                onClick={handleLaunchNow} 
                                disabled={launchMutation.isPending} 
                                variant="success"
                                className="flex-1"
                             >
                                {launchMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                                Launch Immediately
                             </GameButton>
                        </div>
                        <p className="text-center text-[10px] text-gray-400 dark:text-slate-500 mt-2">
                            "Save to Vault" adds it to the rotation pool.<br/>
                            "Launch Immediately" overrides the current active quest.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};