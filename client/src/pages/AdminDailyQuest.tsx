import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Send, Trash2, ArrowLeft, Loader2, 
  BarChart3, TimerOff, UserCheck, Clock, ShieldCheck 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client'; // 
import { toast } from 'react-toastify'; // 
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // 

interface Option {
  id?: string;
  text: string;
  isCorrect: boolean;
}

const AdminDailyQuest = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [question, setQuestion] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('24');
  const [options, setOptions] = useState<Option[]>([
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);

  // --- 1. FETCH ACTIVE QUEST (LIVE POLLING) ---
  const { data: activeQuest, isLoading: loadingActive } = useQuery({
    queryKey: ['admin-active-quest'],
    queryFn: async () => {
      const res = await client.get('/daily/active');
      return res.data;
    },
    refetchInterval: 5000, // Poll every 5 seconds for live results
  });

  // --- 2. MUTATIONS ---
  const launchMutation = useMutation({
    mutationFn: async (payload: any) => client.post('/daily/create', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-active-quest'] });
      toast.success("Quest Launched! Team notified in ClickUp.");
      setQuestion('');
      setOptions(options.map(o => ({ ...o, text: '' })));
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Launch failed")
  });

  const closeMutation = useMutation({
    mutationFn: async () => client.patch(`/daily/${activeQuest?.id}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-active-quest'] });
      queryClient.invalidateQueries({ queryKey: ['active-question'] });
      toast.info("Quest closed manually.");
    }
  });

  // --- 3. HANDLERS ---
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index].text = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || options.some(opt => !opt.text.trim())) {
      toast.warning("Complete the question and all 4 options.");
      return;
    }

    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + parseInt(expiresInHours));

    launchMutation.mutate({ 
      question, 
      options, 
      expiresAt: expiryDate.toISOString() 
    });
  };

  // --- 4. RENDER LIVE RESULTS ---
  const totalVotes = activeQuest?.responses?.length || 0;

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] p-6 lg:p-10 transition-colors duration-500">
      <div className="max-w-5xl mx-auto">
        
        {/* Navigation */}
        <button onClick={() => navigate(-1)} className="group mb-6 flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors font-medium text-sm">
          <div className="p-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm"><ArrowLeft size={16} /></div>
          Back to Dashboard
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* --- LEFT: CREATE QUEST FORM --- */}
          <div className="lg:col-span-7 space-y-6">
            <div className="mb-4">
              <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                <Sparkles className="text-yellow-500" /> Quest Master
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 text-balance">Deploy a new challenge to the team. This will deactivate any previous active quests.</p>
            </div>

            <div className="bg-white dark:bg-[#121418] rounded-3xl border border-gray-200 dark:border-white/10 p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600"></div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-2">The Question</label>
                  <textarea 
                    rows={3}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all resize-none text-sm font-medium"
                    placeholder="Ask something engaging..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {options.map((opt, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Option 0{idx + 1}</label>
                      <input 
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-xs dark:text-white transition-all"
                        placeholder="Choice text..."
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Expiration</label>
                    <select 
                      value={expiresInHours}
                      onChange={(e) => setExpiresInHours(e.target.value)}
                      className="bg-transparent text-xs font-bold text-blue-600 dark:text-blue-400 outline-none cursor-pointer"
                    >
                      <option value="1">Ends in 1 Hour</option>
                      <option value="4">Ends in 4 Hours</option>
                      <option value="12">Ends in 12 Hours</option>
                      <option value="24">Ends in 24 Hours</option>
                      <option value="48">Ends in 2 Days</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    disabled={launchMutation.isPending}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                  >
                    {launchMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    Deploy Quest
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* --- RIGHT: LIVE INTELLIGENCE --- */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                   <BarChart3 size={16} /> Live Feed
                </h2>
                {activeQuest && (
                    <button 
                        onClick={() => closeMutation.mutate()}
                        className="text-[10px] font-black uppercase text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
                    >
                        <TimerOff size={12} /> Force Close
                    </button>
                )}
            </div>

            {loadingActive ? (
                <div className="h-64 flex flex-col items-center justify-center bg-white dark:bg-[#121418] rounded-3xl border border-dashed border-gray-200 dark:border-white/10 opacity-50">
                    <Loader2 size={24} className="animate-spin mb-2" />
                    <span className="text-xs">Connecting to Oracle...</span>
                </div>
            ) : activeQuest ? (
                <div className="space-y-6">
                    {/* Progress Chart */}
                    <div className="bg-white dark:bg-[#121418] rounded-3xl border border-gray-200 dark:border-white/10 p-6 shadow-sm">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <p className="text-[10px] font-bold text-blue-500 uppercase">Active Status</p>
                                <h3 className="text-lg font-bold dark:text-white truncate max-w-[200px]">{activeQuest.question}</h3>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-black text-blue-600">{totalVotes}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Total Votes</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {activeQuest.options.map((opt: any) => {
                                const count = activeQuest.responses?.filter((r: any) => r.optionId === opt.id).length || 0;
                                const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                                return (
                                    <div key={opt.id}>
                                        <div className="flex justify-between text-[10px] font-bold mb-1 uppercase text-gray-500 dark:text-gray-400">
                                            <span className="truncate w-3/4">{opt.text}</span>
                                            <span>{Math.round(pct)}%</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 dark:bg-white/5 w-full rounded-full overflow-hidden">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full bg-blue-500" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Personnel List */}
                    <div className="bg-white dark:bg-[#121418] rounded-3xl border border-gray-200 dark:border-white/10 p-6 shadow-sm h-[320px] flex flex-col">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Voters Authenticated</p>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                            {activeQuest.responses?.length > 0 ? activeQuest.responses.map((resp: any) => (
                                <div key={resp.id} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 transition-colors">
                                    <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm overflow-hidden">
                                        {resp.user?.avatar ? <img src={resp.user.avatar} className="object-cover w-full h-full" /> : resp.user?.name?.charAt(0)}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold dark:text-gray-200">{resp.user?.name || "Member"}</span>
                                        <span className="text-[9px] text-gray-500">{new Date(resp.createdAt).toLocaleTimeString()}</span>
                                    </div>
                                    <UserCheck size={14} className="text-green-500 ml-auto" />
                                </div>
                            )) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                                    <Clock size={32} className="mb-2" />
                                    <p className="text-[10px] font-bold uppercase">Awaiting Participation</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-64 flex flex-col items-center justify-center bg-white dark:bg-[#121418] rounded-3xl border-2 border-dashed border-gray-200 dark:border-white/10 text-gray-400">
                    <ShieldCheck size={40} strokeWidth={1} className="mb-2" />
                    <p className="text-xs font-bold uppercase">System Idle</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDailyQuest;