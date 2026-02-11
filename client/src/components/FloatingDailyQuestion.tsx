import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import DailyQuestionModal from './DailyQuestionModal';
import LeaderboardModal from './LeaderboardModal';
import { Flame, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ✅ IMPORT YOUR GIF
import robotGif from '../assets/robot.gif';

const BOX_SIZE = 80; 
const DAMPING = 0.95; 
const MAX_VELOCITY = 15;
const WANDER_STRENGTH = 0.05; 

const FloatingDailyQuestion = () => {
  const { user } = useAuth(); // Get current user state
  const queryClient = useQueryClient();
  const buttonRef = useRef<HTMLDivElement>(null);
  
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [displayedText, setDisplayedText] = useState("");

  // 1. Get Active Question (Updated with Polling & User Dependency)
  const { data: question } = useQuery({
    queryKey: ['active-question', user?.id], // ✅ Key changes on login -> Forces instant fetch
    queryFn: async () => {
      try {
        const res = await client.get('/daily/active');
        return res.data;
      } catch (err) {
        return null; // Return null on 404/Error so we don't crash
      }
    },
    refetchInterval: 5000, // ✅ Checks for new quest every 5 seconds (No reload needed)
    retry: false,
    enabled: !!user // 🛑 CRITICAL FIX: Only run this query if user is logged in!
  });

  // 2. Get User Streak
  const { data: userData } = useQuery({
      queryKey: ['user-streak', user?.id],
      queryFn: async () => (await client.get('/auth/me')).data,
      enabled: !!user
  });

  const streak = userData?.streak || 0;
  const hasVoted = question?.responses?.some((r: any) => r.userId === user?.id);

  // --- PHYSICS ENGINE ---
  const pos = useRef({ x: window.innerWidth - 100, y: window.innerHeight - 150 });
  const vel = useRef({ x: 1, y: 1 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const animationFrame = useRef<number>(0);
  const timeOffset = useRef(Math.random() * 100);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastTime = useRef(Date.now());
  const isClick = useRef(true);

  // --- TYPEWRITER EFFECT ---
  useEffect(() => {
    if (!question) return;
    const targetText = hasVoted ? "System Standby..." : "Capydam Quest Available!";
    let timeout: ReturnType<typeof setTimeout>;
    let charIndex = 0;

    const typeLoop = () => {
        setDisplayedText(targetText.slice(0, charIndex));
        charIndex++;
        if (charIndex <= targetText.length) {
            timeout = setTimeout(typeLoop, 50);
        }
    };
    typeLoop();
    return () => clearTimeout(timeout);
  }, [question, hasVoted]);

  // --- ANIMATION LOOP ---
  const update = useCallback(() => {
    if (!buttonRef.current || !question) return;
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
  }, [question]);

  useEffect(() => {
    animationFrame.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame.current);
  }, [update]);

  // --- HANDLERS ---
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    isClick.current = true;
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

    if (isClick.current) {
        const target = e.target as HTMLElement;
        if (target.closest('.leaderboard-btn')) {
            setIsLeaderboardOpen(true);
        } else {
            setIsOpen(true);
        }
    }
  };

  if (!question) return null;

  return (
    <>
      <div
        ref={buttonRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="fixed top-0 left-0 z-[9998] group cursor-grab touch-none select-none outline-none"
        style={{ width: BOX_SIZE, height: BOX_SIZE, willChange: 'transform' }}
      >
        {/* Tooltip Bubble */}
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute -top-10 -left-12 w-48 flex justify-center pointer-events-none"
            >
                <div className="bg-slate-900 text-green-400 border-2 border-green-500 text-[10px] font-mono font-bold px-3 py-1.5 rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] uppercase tracking-wide">
                    {displayedText}
                    {/* Pixel Triangle */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r-2 border-b-2 border-green-500 rotate-45"></div>
                </div>
            </motion.div>
        </AnimatePresence>

        {/* 🤖 THE ROBOT */}
        <motion.div 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9, y: 5 }}
            className="w-full h-full relative"
        >
            <img 
                src={robotGif} 
                alt="Quest Robot"
                draggable={false} 
                className={`
                    w-full h-full object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]
                    scale-x-[-1] 
                    ${hasVoted ? 'grayscale opacity-70' : ''}
                `}
            />

            {/* Streak Badge (Attached to Corner) */}
            {streak > 0 && (
                <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded border-2 border-black shadow-sm flex items-center gap-0.5 z-10">
                    <Flame size={10} fill="currentColor" /> {streak}
                </div>
            )}
        </motion.div>

        {/* 🏆 LEADERBOARD BUTTON (Hanging Below) */}
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="leaderboard-btn absolute -bottom-2 -left-2 w-8 h-8 bg-yellow-400 hover:bg-yellow-300 text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] flex items-center justify-center z-20"
            title="View Rankings"
        >
            <Trophy size={14} className="text-black" />
        </motion.button>

      </div>

      {/* Modals */}
      <DailyQuestionModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        question={question}
        onVoteSuccess={() => {
            setIsOpen(false);
            queryClient.invalidateQueries({ queryKey: ['user-streak'] });
            queryClient.invalidateQueries({ queryKey: ['active-question'] });
        }}
      />
      
      <LeaderboardModal 
        isOpen={isLeaderboardOpen} 
        onClose={() => setIsLeaderboardOpen(false)} 
      />
    </>
  );
};

export default FloatingDailyQuestion;