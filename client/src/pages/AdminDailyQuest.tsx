import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Loader2, 
  StopCircle, Plus, 
  Swords, Skull, Trophy, History, Database
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { toast } from 'react-toastify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- IMPORTS ---
import { GameCard } from '../components/daily-quest/ui/GameCard';
import { GameButton } from '../components/daily-quest/ui/GameButton';
import { CountdownTimer } from '../components/daily-quest/ui/CountdownTimer';
import LeaderboardModal from '../components/LeaderboardModal'; 

// New Modals
import { CreateQuestModal } from '../components/daily-quest/modals/CreateQuestModal';
import { HistoryModal } from '../components/daily-quest/modals/HistoryModal';
import { VaultModal } from '../components/daily-quest/modals/VaultModal';
import { VoteDetailModal } from '../components/daily-quest/modals/VoteDetailModal';

interface DashboardData {
  activeQuest: any;
  totalUsers: number;
  history: any[];
  scheduled: any[]; // Kept in interface just in case API returns it, but ignored in UI
  drafts?: any[];
}

const AdminDailyQuest = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  
  const [selectedVote, setSelectedVote] = useState<any>(null);
  const [draftToEquip, setDraftToEquip] = useState<any>(null);

  // --- DATA ---
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['quest-stats'],
    queryFn: async () => (await client.get('/daily/stats')).data,
    refetchInterval: 3000, 
  });

  const activeQuest = data?.activeQuest;
  const totalVotes = activeQuest?.responses?.length || 0;
  const pendingVotes = Math.max(0, (data?.totalUsers || 0) - totalVotes);

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
      queryClient.invalidateQueries({ queryKey: ['active-question'] });
  };

  const handleEquip = (questionData: any) => {
      setDraftToEquip(questionData);
      setIsVaultOpen(false); 
      setIsCreateOpen(true); 
  };

  const handleCreateClose = () => {
      setIsCreateOpen(false);
      setDraftToEquip(null);
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-8 font-sans text-gray-900 dark:text-slate-100 transition-colors duration-500">
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
            <div className="flex gap-4 flex-wrap">
                <GameButton onClick={() => setIsLeaderboardOpen(true)} variant="gold"><Trophy size={16} /> Rankings</GameButton>
                <GameButton onClick={() => setIsVaultOpen(true)} variant="neutral"><Database size={16} /> Manage Vault</GameButton>
                <GameButton onClick={() => setIsHistoryOpen(true)} variant="neutral"><History size={16} /> Logs</GameButton>
                <GameButton onClick={() => setIsCreateOpen(true)} variant="primary"><Plus size={16} /> New Quest</GameButton>
            </div>
        </div>

        {/* --- MAIN GRID --- */}
        {activeQuest ? (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* 1. LEFT: ACTIVE QUEST SCREEN */}
                <div className="xl:col-span-7 flex flex-col gap-6">
                    <GameCard className="p-8 relative overflow-hidden min-h-[500px] flex flex-col bg-gray-100 dark:bg-slate-800">
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
                        <h2 className="text-2xl md:text-3xl font-black leading-tight mb-8 text-gray-900 dark:text-white">{activeQuest.question}</h2>
                        
                        {/* Results Bars */}
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
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "circOut" }} className={`h-full ${isWinner ? 'bg-green-500' : 'bg-indigo-500'}`} />
                                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
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

                {/* 2. RIGHT: VOTER LOG */}
                <div className="xl:col-span-5">
                    <GameCard className="flex flex-col h-full min-h-[600px] overflow-hidden bg-gray-50 dark:bg-black">
                        <div className="p-4 border-b-4 border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 flex justify-between items-center">
                             <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                                <Swords size={16} className="text-orange-500" /> Battle Log
                             </h3>
                             <span className="bg-white dark:bg-slate-900 px-2 py-1 text-[10px] font-mono text-green-600 dark:text-green-400 border border-gray-300 dark:border-slate-700 rounded">LIVE</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {activeQuest.responses?.length > 0 ? (
                                activeQuest.responses.map((resp: any) => (
                                    <div key={resp.id} onClick={() => setSelectedVote(resp)} className="group flex items-center justify-between p-3 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 border-l-4 border-gray-300 dark:border-slate-700 hover:border-indigo-500 transition-all cursor-pointer shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-700 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-xs rounded-sm overflow-hidden">
                                                 {resp.user?.avatar ? <img src={resp.user.avatar} className="w-full h-full object-cover" /> : <span>{resp.user?.name?.[0]}</span>}
                                            </div>
                                            <div>
                                                <div className="font-bold text-xs text-gray-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-white uppercase">{resp.user?.name || 'Unknown'}</div>
                                                <div className="text-[9px] text-gray-500 dark:text-slate-500 font-mono group-hover:text-indigo-500 dark:group-hover:text-indigo-400">&gt; View Data</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                             <span className="text-[9px] font-mono text-gray-400 dark:text-slate-600 block">{new Date(resp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                ))
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
        <CreateQuestModal isOpen={isCreateOpen} onClose={handleCreateClose} onSuccess={refreshData} initialData={draftToEquip} />
        <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={data?.history} />
        <VaultModal isOpen={isVaultOpen} onClose={() => setIsVaultOpen(false)} onEquip={handleEquip} />
        <LeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} />
        {selectedVote && <VoteDetailModal vote={selectedVote} onClose={() => setSelectedVote(null)} />}

      </div>
    </div>
  );
};

export default AdminDailyQuest;