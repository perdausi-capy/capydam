import React from 'react';
import { motion } from 'framer-motion';
import { X, Trophy, Flame, Medal, Crown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';

const LeaderboardModal = ({ isOpen, onClose }: any) => {
  const { data: leaders, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => (await client.get('/daily/leaderboard')).data,
    enabled: isOpen
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ y: 20, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl border-4 border-yellow-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[85vh]"
      >
        
        {/* 🏆 ARCADE HEADER */}
        <div className="p-4 bg-yellow-500 border-b-4 border-black flex justify-between items-center relative overflow-hidden">
            {/* Pattern Overlay */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
            
            <div className="relative z-10 flex items-center gap-3">
                <div className="p-2 bg-black/10 rounded-lg border-2 border-black/10">
                    <Trophy size={24} className="text-black animate-bounce" fill="currentColor" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-black uppercase tracking-widest leading-none">Hall of Fame</h2>
                    <p className="text-[10px] font-bold text-black/60 uppercase tracking-wide mt-1">Top Champions</p>
                </div>
            </div>
            <button onClick={onClose} className="relative z-10 p-2 hover:bg-black/10 rounded-lg transition-colors group">
                <X size={24} className="text-black group-hover:rotate-90 transition-transform" />
            </button>
        </div>

        {/* 📜 LIST */}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-gray-50 dark:bg-slate-900/50">
            {isLoading ? (
                <div className="text-center py-12 opacity-50 font-mono text-sm uppercase animate-pulse dark:text-white">Loading scores...</div>
            ) : (
                <div className="space-y-3">
                    {leaders?.map((user: any, index: number) => {
                        // 🎨 Determine Rank Styling
                        let cardStyle = "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700";
                        let rankIcon = <span className="font-mono font-bold text-gray-400 text-lg">#{index + 1}</span>;
                        let scoreColor = "text-indigo-600 dark:text-indigo-400";

                        if (index === 0) {
                            // GOLD
                            cardStyle = "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 shadow-md transform scale-[1.02]";
                            rankIcon = <Crown size={24} className="text-yellow-600 dark:text-yellow-400 drop-shadow-sm" fill="currentColor" />;
                            scoreColor = "text-yellow-600 dark:text-yellow-400";
                        } else if (index === 1) {
                            // SILVER
                            cardStyle = "bg-gray-50 dark:bg-slate-800 border-gray-400";
                            rankIcon = <Medal size={22} className="text-gray-400" fill="currentColor" />;
                            scoreColor = "text-gray-500 dark:text-gray-300";
                        } else if (index === 2) {
                            // BRONZE
                            cardStyle = "bg-orange-50 dark:bg-orange-900/10 border-orange-400";
                            rankIcon = <Medal size={22} className="text-orange-500" fill="currentColor" />;
                            scoreColor = "text-orange-600 dark:text-orange-400";
                        }

                        return (
                            <div key={user.id} className={`flex items-center gap-4 p-3 rounded-lg border-b-4 border-r-2 border-l-2 border-t-2 ${cardStyle} transition-all`}>
                                
                                {/* Rank Icon */}
                                <div className="w-8 flex justify-center">{rankIcon}</div>

                                {/* Avatar */}
                                <div className="w-10 h-10 rounded bg-gray-200 dark:bg-black border-2 border-gray-300 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                                    {user.avatar ? (
                                        <img src={user.avatar} className="w-full h-full object-cover" alt={user.name} />
                                    ) : (
                                        <div className="font-black text-gray-400 dark:text-slate-600">{user.name[0]}</div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate uppercase tracking-tight">{user.name}</h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800 flex items-center gap-1">
                                            <Flame size={10} fill="currentColor" /> {user.streak} DAY STREAK
                                        </span>
                                    </div>
                                </div>

                                {/* Score */}
                                <div className="text-right">
                                    <div className={`font-black text-lg leading-none ${scoreColor}`}>{user.score}</div>
                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">XP</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      </motion.div>
    </div>
  );
};

export default LeaderboardModal;