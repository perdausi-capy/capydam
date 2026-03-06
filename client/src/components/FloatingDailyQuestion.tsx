import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import DailyQuestionModal from './DailyQuestionModal';
import LeaderboardModal from './LeaderboardModal';
import { Flame, Trophy } from 'lucide-react'; 
import { useAuth } from '../context/AuthContext';
import { SeasonRecapModal } from './daily-quest/modals/SeasonRecapModal';

import robotGif from '../assets/robot.gif';

const BOX_SIZE = 80; 
const DAMPING = 0.95; 
const MAX_VELOCITY = 15;
const WANDER_STRENGTH = 0.05; 

const CageIcon = ({ isOpen, className }: { isOpen: boolean, className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="3" r="1" />
    <path d="M12 4v2" />
    <path d="M5 10c0-3.866 3.134-7 7-7s7 3.134 7 7v10H5V10z" />
    <path d="M8 8v12" />
    <path d="M16 8v12" />
    <path d="M5 14h14" />
    <path d="M3 20h18v2H3z" fill="currentColor" />
    <g className={`transition-transform duration-300 origin-top ${isOpen ? 'scale-y-0 opacity-0' : 'scale-y-100 opacity-100'}`}>
      <path d="M12 8v12" strokeWidth="2" />
      <path d="M10 8v12" />
      <path d="M14 8v12" />
    </g>
  </svg>
);

const FloatingDailyQuestion = () => {
  const { user } = useAuth(); 
  const queryClient = useQueryClient();
  const buttonRef = useRef<HTMLDivElement>(null);
  
  // ✅ SYNCED CAGE STATES
  const [isRobotCaged, setIsRobotCaged] = useState(() => localStorage.getItem('capy_robot_caged') === 'true');
  const [isCapyCaged, setIsCapyCaged] = useState(() => localStorage.getItem('capy_theme_caged') === 'true');
  const wasCaged = useRef(isRobotCaged);

  useEffect(() => {
    const syncState = () => {
        const rCaged = localStorage.getItem('capy_robot_caged') === 'true';
        const cCaged = localStorage.getItem('capy_theme_caged') === 'true';
        
        // Jailbreak Physics!
        if (wasCaged.current && !rCaged) {
            pos.current = { x: window.innerWidth / 2 + 30, y: window.innerHeight / 2 };
            vel.current = { x: 15, y: -25 }; // Burst up and RIGHT
        }
        
        wasCaged.current = rCaged;
        setIsRobotCaged(rCaged);
        setIsCapyCaged(cCaged);
    };
    window.addEventListener('cage_update', syncState);
    return () => window.removeEventListener('cage_update', syncState);
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [displayedText, setDisplayedText] = useState("");

  const [isDraggingVisual, setIsDraggingVisual] = useState(false);
  const [isOverDropZone, setIsOverDropZone] = useState(false);

  const { data: question } = useQuery({
    queryKey: ['active-question', user?.id],
    queryFn: async () => {
      try {
        const res = await client.get('/daily/active');
        return res.data;
      } catch (err) { return null; }
    },
    refetchInterval: 5000, 
    retry: false,
    enabled: !!user && !isRobotCaged
  });

  const { data: userData } = useQuery({
      queryKey: ['user-streak', user?.id],
      queryFn: async () => (await client.get('/auth/me')).data,
      enabled: !!user && !isRobotCaged
  });

  const { data: recapSnapshot } = useQuery({
    queryKey: ['season-recap-snapshot'],
    queryFn: async () => (await client.get('/daily/recap')).data,
    enabled: !!user
  });

  const streak = userData?.streak || 0;
  const hasVoted = question?.responses?.some((r: any) => r.userId === user?.id);

  const pos = useRef({ x: window.innerWidth - 100, y: window.innerHeight - 150 });
  const vel = useRef({ x: 1, y: 1 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const animationFrame = useRef<number>(0);
  const timeOffset = useRef(Math.random() * 100);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastTime = useRef(Date.now());
  const isClick = useRef(true);

  useEffect(() => {
    if (!question || isRobotCaged) return;
    const targetText = hasVoted ? "System Standby..." : "Capydam Quest Available!";
    let timeout: ReturnType<typeof setTimeout>;
    let charIndex = 0;

    const typeLoop = () => {
        setDisplayedText(targetText.slice(0, charIndex));
        charIndex++;
        if (charIndex <= targetText.length) timeout = setTimeout(typeLoop, 50);
    };
    typeLoop();
    return () => clearTimeout(timeout);
  }, [question, hasVoted, isRobotCaged]);

  const update = useCallback(() => {
    if (!buttonRef.current || !question || isRobotCaged) return;
    if (!isDragging.current) {
        const padding = 20;
        const maxX = window.innerWidth - BOX_SIZE - padding;
        const maxY = window.innerHeight - BOX_SIZE - padding;

        pos.current.x += vel.current.x;
        pos.current.y += vel.current.y;

        if (pos.current.x <= padding) { pos.current.x = padding; vel.current.x *= -1; } 
        else if (pos.current.x >= maxX) { pos.current.x = maxX; vel.current.x *= -1; }
        if (pos.current.y <= padding) { pos.current.y = padding; vel.current.y *= -1; } 
        else if (pos.current.y >= maxY) { pos.current.y = maxY; vel.current.y *= -1; }

        const speed = Math.sqrt(vel.current.x**2 + vel.current.y**2);
        if (speed > 0.5) { vel.current.x *= DAMPING; vel.current.y *= DAMPING; } 
        else {
            const time = Date.now() / 1000 + timeOffset.current;
            vel.current.x += Math.sin(time * 2) * WANDER_STRENGTH;
            vel.current.y += Math.cos(time * 1.5) * WANDER_STRENGTH;
        }
    }
    buttonRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
    animationFrame.current = requestAnimationFrame(update);
  }, [question, isRobotCaged]);

  useEffect(() => {
    if (!isRobotCaged) animationFrame.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame.current);
  }, [update, isRobotCaged]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    isClick.current = true;
    setIsDraggingVisual(true); 
    lastPos.current = { x: e.clientX, y: e.clientY };
    lastTime.current = Date.now();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragOffset.current = { x: e.clientX - pos.current.x, y: e.clientY - pos.current.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    if (Math.abs(e.clientX - lastPos.current.x) > 5) isClick.current = false;
    
    pos.current.x = e.clientX - dragOffset.current.x;
    pos.current.y = e.clientY - dragOffset.current.y;

    const overZone = Math.hypot(e.clientX - (window.innerWidth / 2), e.clientY - (window.innerHeight - 80)) < 120;
    setIsOverDropZone(overZone);

    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
        vel.current = { 
            x: Math.min(Math.max((e.clientX - lastPos.current.x), -MAX_VELOCITY), MAX_VELOCITY), 
            y: Math.min(Math.max((e.clientY - lastPos.current.y), -MAX_VELOCITY), MAX_VELOCITY) 
        };
        lastPos.current = { x: e.clientX, y: e.clientY };
        lastTime.current = now;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setIsDraggingVisual(false);

    const overZone = Math.hypot(e.clientX - (window.innerWidth / 2), e.clientY - (window.innerHeight - 80)) < 120;
    setIsOverDropZone(false);

    if (overZone) {
        localStorage.setItem('capy_robot_caged', 'true');
        window.dispatchEvent(new Event('cage_update')); // Notify Capybara!
        return; 
    }

    if (isClick.current) {
        const target = e.target as HTMLElement;
        if (target.closest('.leaderboard-btn')) setIsLeaderboardOpen(true);
        else setIsOpen(true);
    }
  };

  const handleRelease = () => {
      // Clear BOTH cages! Jailbreak!
      localStorage.removeItem('capy_robot_caged');
      localStorage.removeItem('capy_theme_caged');
      window.dispatchEvent(new Event('cage_update')); 
  };

  return (
    <>
      <AnimatePresence>
        {isDraggingVisual && (
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.8, x: '-50%' }} // ✅ Reduced y-distance for faster entry
            animate={{ y: 0, opacity: 1, scale: isOverDropZone ? 1.1 : 1, x: '-50%' }}
            exit={{ y: 100, opacity: 0, scale: 0.8, x: '-50%' }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }} // ✅ Snaps up instantly
            className={`fixed bottom-6 left-1/2 z-[9999] px-6 py-4 rounded-t-3xl rounded-b-xl flex flex-col items-center justify-center gap-1 shadow-2xl border-2 pointer-events-none ${ // ✅ Smaller padding/gap
              isOverDropZone 
                ? 'bg-amber-500/20 backdrop-blur-md border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.6)]' 
                : 'bg-zinc-900/80 backdrop-blur-md border-zinc-600'
            }`}
          >
            <CageIcon isOpen={isOverDropZone} className={`w-8 h-8 transition-colors duration-200 ${isOverDropZone ? 'text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]' : 'text-zinc-400'}`} /> {/* ✅ Smaller icon w-8 */}
            <span className={`font-black tracking-widest text-[10px] uppercase whitespace-nowrap transition-colors duration-200 ${isOverDropZone ? 'text-amber-200' : 'text-zinc-400'}`}>
              {isOverDropZone ? 'Release to Trap' : 'Drag to Cage'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔒 THE MASTER CAGE */}
      {isRobotCaged && (
         <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05, rotate: -3 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRelease}
            className="fixed bottom-8 right-8 z-[9999] w-24 h-24 bg-zinc-900 border-2 border-zinc-600 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center justify-center group outline-none overflow-hidden"
            title="Click to free them!"
         >
            <div className="absolute -top-10 bg-zinc-800 text-zinc-200 text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold shadow-lg pointer-events-none z-50">
              Free {isCapyCaged ? 'us' : 'me'}! 🥺
            </div>
            <div className="relative w-full h-full flex items-center justify-center">
              {/* ROBOT: Sits center if alone, left if sharing */}
              <img src={robotGif} className={`absolute bottom-3 ${isCapyCaged ? 'left-2' : 'left-1/2 -translate-x-1/2'} w-11 h-11 object-contain z-10 opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300 scale-x-[-1]`} />
              <CageIcon isOpen={false} className="absolute inset-0 w-full h-full text-zinc-500 z-20 transition-colors group-hover:text-amber-400" />
            </div>
         </motion.button>
      )}

      {question && !isRobotCaged && (
        <div
          ref={buttonRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="fixed top-0 left-0 z-[9998] group cursor-grab touch-none select-none outline-none"
          style={{ width: BOX_SIZE, height: BOX_SIZE, willChange: 'transform' }}
        >
          <AnimatePresence>
              <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute -top-10 -left-12 w-48 flex justify-center pointer-events-none"
              >
                  <div className="bg-slate-900 text-green-400 border-2 border-green-500 text-[10px] font-mono font-bold px-3 py-1.5 rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] uppercase tracking-wide">
                      {displayedText}
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r-2 border-b-2 border-green-500 rotate-45"></div>
                  </div>
              </motion.div>
          </AnimatePresence>

          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9, y: 5 }} className="w-full h-full relative">
              <img src={robotGif} draggable={false} className={`w-full h-full object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] scale-x-[-1] ${hasVoted ? 'grayscale opacity-70' : ''}`} />
              {streak > 0 && (
                  <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded border-2 border-black shadow-sm flex items-center gap-0.5 z-10">
                      <Flame size={10} fill="currentColor" /> {streak}
                  </div>
              )}
          </motion.div>

          <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="leaderboard-btn absolute -bottom-2 -left-2 w-8 h-8 bg-yellow-400 hover:bg-yellow-300 text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] flex items-center justify-center z-20 pointer-events-auto"
          >
              <Trophy size={14} className="text-black" />
          </motion.button>
        </div>
      )}

      {question && (
        <DailyQuestionModal 
          isOpen={isOpen} onClose={() => setIsOpen(false)} question={question}
          onVoteSuccess={() => { setIsOpen(false); queryClient.invalidateQueries({ queryKey: ['user-streak'] }); queryClient.invalidateQueries({ queryKey: ['active-question'] }); }}
        />
      )}
      <LeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} />
      <SeasonRecapModal recapData={recapSnapshot} currentUser={user} />
    </>
  );
};
export default FloatingDailyQuestion;