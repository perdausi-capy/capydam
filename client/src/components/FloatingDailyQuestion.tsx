import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
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

const FloatingDailyQuestion = () => {
  const { user } = useAuth(); 
  const queryClient = useQueryClient();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [displayedText, setDisplayedText] = useState("");

  const [flyAnim, setFlyAnim] = useState(false);
  const [hidden, setHidden] = useState(false);

  const isPhysicsActive = useRef(true);

  // Framer Motion coordinates
  const x = useMotionValue(window.innerWidth - 100);
  const y = useMotionValue(window.innerHeight - 150);

  useEffect(() => {
    const handleOpenLeaderboard = () => setIsLeaderboardOpen(true);
    window.addEventListener('open_leaderboard', handleOpenLeaderboard);
    return () => window.removeEventListener('open_leaderboard', handleOpenLeaderboard);
  }, []);

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
    enabled: !!user
  });

  const { data: userData } = useQuery({
      queryKey: ['user-streak', user?.id],
      queryFn: async () => (await client.get('/auth/me')).data,
      enabled: !!user
  });

  const { data: recapSnapshot } = useQuery({
    queryKey: ['season-recap-snapshot'],
    queryFn: async () => (await client.get('/daily/recap')).data,
    enabled: !!user
  });

  const streak = userData?.streak || 0;
  const hasVoted = question?.responses?.some((r: any) => r.userId === user?.id);

  useEffect(() => {
    if (hasVoted && !flyAnim && !isOpen) {
        setHidden(true);
    } else if (!hasVoted && hidden) {
        setHidden(false);
        setFlyAnim(false);
        isPhysicsActive.current = true;
        pos.current = { x: window.innerWidth - 100, y: window.innerHeight - 150 };
        x.set(pos.current.x);
        y.set(pos.current.y);
    }
  }, [hasVoted, flyAnim, isOpen, hidden, x, y]);

  useEffect(() => {
    if (!question || hidden) return;
    const targetText = "Capydam Quest Available!";
    let timeout: ReturnType<typeof setTimeout>;
    let charIndex = 0;

    const typeLoop = () => {
        setDisplayedText(targetText.slice(0, charIndex));
        charIndex++;
        if (charIndex <= targetText.length) timeout = setTimeout(typeLoop, 50);
    };
    typeLoop();
    return () => clearTimeout(timeout);
  }, [question, hidden]);

  const pos = useRef({ x: window.innerWidth - 100, y: window.innerHeight - 150 });
  const vel = useRef({ x: 1, y: 1 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const animationFrame = useRef<number>(0);
  const timeOffset = useRef(Math.random() * 100);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastTime = useRef(Date.now());
  const isClick = useRef(true);

  const update = useCallback(() => {
    if (!isPhysicsActive.current || !question || hidden || flyAnim) return;
    
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
    
    x.set(pos.current.x);
    y.set(pos.current.y);
    
    animationFrame.current = requestAnimationFrame(update);
  }, [question, hidden, flyAnim, x, y]);

  useEffect(() => {
    if (!hidden && !flyAnim && isPhysicsActive.current) {
        animationFrame.current = requestAnimationFrame(update);
    }
    return () => cancelAnimationFrame(animationFrame.current);
  }, [update, hidden, flyAnim]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (flyAnim) return;
    isDragging.current = true;
    isClick.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    lastTime.current = Date.now();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragOffset.current = { x: e.clientX - pos.current.x, y: e.clientY - pos.current.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || flyAnim) return;
    if (Math.abs(e.clientX - lastPos.current.x) > 5) isClick.current = false;
    
    pos.current.x = e.clientX - dragOffset.current.x;
    pos.current.y = e.clientY - dragOffset.current.y;
    
    x.set(pos.current.x);
    y.set(pos.current.y);

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
    if (!isDragging.current || flyAnim) return;
    isDragging.current = false;

    if (isClick.current) {
        const target = e.target as HTMLElement;
        if (target.closest('.leaderboard-btn')) setIsLeaderboardOpen(true);
        else setIsOpen(true);
    }
  };

  // ✅ HOMING BEACON & IMPACT ANIMATION
  const triggerFlyAnimation = () => {
      setIsOpen(false);
      setFlyAnim(true);
      
      // Stop physics
      isPhysicsActive.current = false;
      cancelAnimationFrame(animationFrame.current);
      
      let targetX = 20; 
      let targetY = window.innerHeight / 2;

      // Locate EXACT pixel coordinates of the sidebar icon
      const targetEl = document.getElementById('leaderboard-target-icon');
      if (targetEl) {
          const rect = targetEl.getBoundingClientRect();
          targetX = rect.left + (rect.width / 2) - 8; 
          targetY = rect.top + (rect.height / 2) - 72;
      }
      
      animate(x, targetX, { duration: 1.2, ease: "easeInOut" });
      animate(y, targetY, { duration: 1.2, ease: "easeInOut" });

      // Impact Effect (Timeout precisely aligns with landing)
      setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['user-streak'] }); 
          queryClient.invalidateQueries({ queryKey: ['active-question'] }); 
          
          // 🔥 SIDEBAR IMPACT: The Button Glow & Icon Wiggle
          const navBtn = document.getElementById('leaderboard-nav-btn');
          if (navBtn) {
              // 1. Give the button a glowing border and slightly scale it
              navBtn.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
              navBtn.classList.add('bg-yellow-500/20', 'ring-2', 'ring-yellow-400', 'shadow-[0_0_25px_rgba(250,204,21,0.7)]', 'transform', 'scale-105');
              
              // 2. Shake the icon inside the button
              if (targetEl) {
                  targetEl.animate([
                      { transform: 'rotate(0deg) scale(1.2)' },
                      { transform: 'rotate(-20deg) scale(1.2)' },
                      { transform: 'rotate(20deg) scale(1.2)' },
                      { transform: 'rotate(-10deg) scale(1.2)' },
                      { transform: 'rotate(10deg) scale(1.2)' },
                      { transform: 'rotate(0deg) scale(1)' }
                  ], { duration: 600, easing: 'ease-in-out' });
              }

              // Remove the button glow after a second
              setTimeout(() => {
                  navBtn.classList.remove('bg-yellow-500/20', 'ring-2', 'ring-yellow-400', 'shadow-[0_0_25px_rgba(250,204,21,0.7)]', 'transform', 'scale-105');
              }, 1200);
          }

          setHidden(true);
          setFlyAnim(false);
      }, 1200);
  };

  if (hidden) {
      return (
        <>
            <LeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} />
            <SeasonRecapModal recapData={recapSnapshot} currentUser={user} />
        </>
      );
  }

  return (
    <>
      {question && (
        <motion.div
          style={{ x, y, width: BOX_SIZE, height: BOX_SIZE }}
          className={`fixed top-0 left-0 z-[9998] group touch-none select-none outline-none flex flex-col items-center ${flyAnim ? 'pointer-events-none' : 'cursor-grab'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Speech Bubble */}
          <AnimatePresence>
              {!flyAnim && (
                  <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute -top-10 -left-12 w-48 flex justify-center pointer-events-none"
                  >
                      <div className="bg-slate-900 text-green-400 border-2 border-green-500 text-[10px] font-mono font-bold px-3 py-1.5 rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] uppercase tracking-wide relative text-center">
                          {displayedText}
                          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r-2 border-b-2 border-green-500 rotate-45"></div>
                      </div>
                  </motion.div>
              )}
          </AnimatePresence>

          {/* Robot Image */}
          <motion.div 
              animate={{ opacity: flyAnim ? 0 : 1, scale: flyAnim ? 0 : 1 }} 
              transition={{ duration: 0.6 }}
              className="w-full h-full relative"
          >
              <img src={robotGif} draggable={false} className="w-full h-full object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] scale-x-[-1]" />
              {streak > 0 && (
                  <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded border-2 border-black shadow-sm flex items-center gap-0.5 z-10">
                      <Flame size={10} fill="currentColor" /> {streak}
                  </div>
              )}
          </motion.div>

          {/* ✅ THE GIGGLE & CARVING KEYFRAME ANIMATION */}
          <motion.button
              animate={{ 
                  scale: flyAnim ? [1, 3, 1.4] : 1, 
                  rotate: flyAnim ? [0, -15, 15, -15, 15, 0] : 0, // 🔥 The Giggle Effect!
                  backgroundColor: flyAnim ? ["#facc15", "#facc15", "rgba(0,0,0,0)"] : "#facc15",
                  borderColor: flyAnim ? ["#000", "#000", "rgba(0,0,0,0)"] : "#000",
                  boxShadow: flyAnim ? ["2px 2px 0px 0px rgba(0,0,0,0.5)", "0 0 60px rgba(250,204,21,1)", "0 0 0px rgba(0,0,0,0)"] : "2px 2px 0px 0px rgba(0,0,0,0.5)",
                  color: flyAnim ? ["#000", "#000", "#eab308"] : "#000", 
                  x: flyAnim ? [0, 15, 0] : 0, 
                  y: flyAnim ? [0, -30, 0] : 0,
                  opacity: flyAnim ? [1, 1, 0] : 1
              }}
              transition={{ 
                  default: { duration: 1.2, times: [0, 0.6, 1], ease: "easeInOut" },
                  rotate: { duration: 1.2, times: [0, 0.2, 0.4, 0.6, 0.8, 1], ease: "linear" }, // Quick giggles spread out
                  opacity: { duration: 1.2, times: [0, 0.95, 1], ease: "linear" } // Fade out right at the very end
              }}
              whileHover={{ scale: flyAnim ? 1 : 1.1 }}
              whileTap={{ scale: flyAnim ? 1 : 0.9 }}
              className="leaderboard-btn absolute -bottom-2 -left-2 w-8 h-8 rounded-lg border-2 flex items-center justify-center z-20 pointer-events-auto"
          >
              <Trophy size={14} color="currentColor" />
          </motion.button>
        </motion.div>
      )}

      {/* Modals */}
      {question && (
        <DailyQuestionModal 
          isOpen={isOpen} 
          onClose={() => setIsOpen(false)} 
          question={question}
          onVoteSuccess={triggerFlyAnimation} 
        />
      )}
      <LeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} />
      <SeasonRecapModal recapData={recapSnapshot} currentUser={user} />
    </>
  );
};

export default FloatingDailyQuestion;