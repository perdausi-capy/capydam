// src/components/FloatingDailyQuestion.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Lottie from 'lottie-react';
import { motion, AnimatePresence } from 'framer-motion';
import witchAnimation from '../assets/witch.json';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import DailyQuestionModal from './DailyQuestionModal';
import { toast } from 'react-toastify';

const FAIRY_SIZE = 85;
const DAMPING = 0.95; 
const MAX_VELOCITY = 15;
const WANDER_STRENGTH = 0.05; 

const FloatingDailyQuestion = () => {
  const queryClient = useQueryClient();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [displayedText, setDisplayedText] = useState("");

  const { data: question } = useQuery({
    queryKey: ['active-question'],
    queryFn: async () => {
      const res = await client.get('/daily/active');
      return res.data;
    }
  });

  const hasVoted = question?.responses?.length > 0;

  // --- PHYSICS STATE ---
  const pos = useRef({ x: window.innerWidth - 150, y: window.innerHeight - 150 });
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
    const targetText = hasVoted ? "I'm resting... 💤" : "New Quest! Click me! ✨";
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

  const update = useCallback(() => {
    if (!buttonRef.current || !question) return;
    if (!isDragging.current) {
        const padding = 20;
        const maxX = window.innerWidth - FAIRY_SIZE - padding;
        const maxY = window.innerHeight - FAIRY_SIZE - padding;

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
    if (isClick.current) setIsOpen(true);
  };

  if (!question) return null;

  return (
    <>
      <button
        ref={buttonRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="fixed top-0 left-0 z-[9998] group cursor-grab touch-none select-none outline-none"
        style={{ 
          width: FAIRY_SIZE, 
          height: FAIRY_SIZE, 
          filter: hasVoted ? 'grayscale(100%) opacity(0.5)' : 'none',
          willChange: 'transform'
        }}
      >
        {/* FIXED TOOLTIP: Added -translate-x-1/3 to shift the arrow over the head */}
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute -top-10 -left-7 -translate-x-1/3 -translate-y-full whitespace-nowrap px-4 py-2 rounded-2xl text-xs font-bold shadow-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-100 dark:border-gray-700 pointer-events-none"
            >
                <span className="font-mono">{displayedText}</span>
                <span className="animate-pulse text-blue-500 font-bold ml-1">|</span>
                
                {/* Arrow shifted to point to the left side of the bubble (the head) */}
                <div className="absolute -bottom-1 left-1/3 -translate-x-1/2 w-2 h-2 bg-white dark:bg-gray-800 rotate-45 border-r border-b border-gray-100 dark:border-gray-700"></div>
            </motion.div>
        </AnimatePresence>

        <Lottie animationData={witchAnimation} loop={true} />
      </button>

      <DailyQuestionModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        question={question}
        userVoted={hasVoted}
      />
    </>
  );
};

export default FloatingDailyQuestion;