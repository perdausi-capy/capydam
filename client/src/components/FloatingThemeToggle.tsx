import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext'; 
import { motion, AnimatePresence } from 'framer-motion';

import capybara from '../assets/nA3Up1.gif';

const FAIRY_SIZE = 75;
const DAMPING = 0.95; 
const MAX_VELOCITY = 15;
const WANDER_STRENGTH = 0.05; 

// ✅ SMALLER, FASTER CAGE ICON ANIMATION
const CageIcon = ({ isOpen, className }: { isOpen: boolean, className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="3" r="1" />
    <path d="M12 4v2" />
    <path d="M5 10c0-3.866 3.134-7 7-7s7 3.134 7 7v10H5V10z" />
    <path d="M8 8v12" />
    <path d="M16 8v12" />
    <path d="M5 14h14" />
    <path d="M3 20h18v2H3z" fill="currentColor" />
    <g className={`transition-transform duration-200 origin-top ${isOpen ? 'scale-y-0 opacity-0' : 'scale-y-100 opacity-100'}`}>
      <path d="M12 8v12" strokeWidth="2" />
      <path d="M10 8v12" />
      <path d="M14 8v12" />
    </g>
  </svg>
);

const FloatingThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // ✅ SYNCED CAGE STATES
  const [isCapyCaged, setIsCapyCaged] = useState(() => localStorage.getItem('capy_theme_caged') === 'true');
  const [isRobotCaged, setIsRobotCaged] = useState(() => localStorage.getItem('capy_robot_caged') === 'true');
  const wasCaged = useRef(isCapyCaged);

  useEffect(() => {
    const syncState = () => {
        const rCaged = localStorage.getItem('capy_robot_caged') === 'true';
        const cCaged = localStorage.getItem('capy_theme_caged') === 'true';
        
        // Jailbreak Physics!
        if (wasCaged.current && !cCaged) {
            pos.current = { x: window.innerWidth / 2 - 30, y: window.innerHeight / 2 };
            vel.current = { x: -15, y: -25 }; // Burst up and LEFT
        }
        
        wasCaged.current = cCaged;
        setIsCapyCaged(cCaged);
        setIsRobotCaged(rCaged);
    };
    window.addEventListener('cage_update', syncState);
    return () => window.removeEventListener('cage_update', syncState);
  }, []);

  const [showTooltip, setShowTooltip] = useState(true);
  const [displayedText, setDisplayedText] = useState("");
  const [reaction, setReaction] = useState<string | null>(null);
  const isFirstRender = useRef(true); 

  const [isDraggingVisual, setIsDraggingVisual] = useState(false);
  const [isOverDropZone, setIsOverDropZone] = useState(false);

  const getInitialPos = () => {
    const saved = localStorage.getItem('witchPos');
    if (saved) {
        try {
            const { x, y } = JSON.parse(saved);
            return { 
                x: Math.min(Math.max(0, x), window.innerWidth - FAIRY_SIZE), 
                y: Math.min(Math.max(0, y), window.innerHeight - FAIRY_SIZE) 
            };
        } catch (e) { return { x: 100, y: 100 }; }
    }
    return { x: 100, y: 100 };
  };

  const pos = useRef(getInitialPos());
  const vel = useRef({ x: 1, y: 1 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const animationFrame = useRef<number>(0);
  const timeOffset = useRef(Math.random() * 100);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastTime = useRef(Date.now());
  const startDragPos = useRef({ x: 0, y: 0 });
  const isClick = useRef(true); 

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (isCapyCaged) return; 
    
    const reactionText = theme === 'dark' ? "Sheesh! 🥶" : "Bright moves! 😎";
    setReaction(reactionText);
    setShowTooltip(true);
    const timer = setTimeout(() => setReaction(null), 3000);
    return () => clearTimeout(timer);
  }, [theme, isCapyCaged]);

  useEffect(() => {
    if (isCapyCaged) return;
    const defaultText = theme === 'light' ? "Too bright? Click me! ✨" : "Too dark? Click me! 🌙";
    const targetText = reaction || defaultText;

    if (!showTooltip) { setDisplayedText(""); return; }

    let timeout: ReturnType<typeof setTimeout>;
    let charIndex = 0;

    const typeLoop = () => {
        setDisplayedText(targetText.slice(0, charIndex));
        charIndex++;
        if (charIndex <= targetText.length) timeout = setTimeout(typeLoop, 50); 
        else {
            if (reaction) return; 
            timeout = setTimeout(() => {
                charIndex = 0;
                setDisplayedText(""); 
                timeout = setTimeout(typeLoop, 500); 
            }, 5000);
        }
    };
    typeLoop();
    return () => clearTimeout(timeout);
  }, [showTooltip, theme, reaction, isCapyCaged]); 

  const update = useCallback(() => {
    if (!buttonRef.current || isCapyCaged) return; 

    if (!isDragging.current) {
        const padding = 10;
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
  }, [isCapyCaged]);

  useEffect(() => {
    if (!isCapyCaged) animationFrame.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame.current);
  }, [update, isCapyCaged]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    isClick.current = true;
    setIsDraggingVisual(true); 
    
    startDragPos.current = { x: e.clientX, y: e.clientY };
    lastPos.current = { x: e.clientX, y: e.clientY };
    lastTime.current = Date.now();

    setShowTooltip(false);
    (e.target as Element).setPointerCapture(e.pointerId);

    dragOffset.current = { x: e.clientX - pos.current.x, y: e.clientY - pos.current.y };
    if (buttonRef.current) {
        buttonRef.current.style.cursor = 'grabbing';
        buttonRef.current.style.transition = 'none';
        buttonRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) scale(1.1)`;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const moveX = Math.abs(e.clientX - startDragPos.current.x);
    const moveY = Math.abs(e.clientY - startDragPos.current.y);
    if (moveX > 5 || moveY > 5) isClick.current = false;

    pos.current.x = e.clientX - dragOffset.current.x;
    pos.current.y = e.clientY - dragOffset.current.y;
    
    const overZone = Math.hypot(e.clientX - (window.innerWidth / 2), e.clientY - (window.innerHeight - 80)) < 120;
    setIsOverDropZone(overZone);

    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
        const vx = (e.clientX - lastPos.current.x); 
        const vy = (e.clientY - lastPos.current.y);
        vel.current = { 
            x: Math.min(Math.max(vx, -MAX_VELOCITY), MAX_VELOCITY), 
            y: Math.min(Math.max(vy, -MAX_VELOCITY), MAX_VELOCITY) 
        };
        lastPos.current = { x: e.clientX, y: e.clientY };
        lastTime.current = now;
    }
    if (buttonRef.current) {
       buttonRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) scale(1.1)`;
    }
  };

  const handleTransition = async (e: React.MouseEvent | React.PointerEvent) => {
    if (!document.startViewTransition) { toggleTheme(e as any); return; }
    const x = pos.current.x + FAIRY_SIZE / 2;
    const y = pos.current.y + FAIRY_SIZE / 2;
    const right = window.innerWidth - x;
    const bottom = window.innerHeight - y;
    const radius = Math.hypot(Math.max(x, right), Math.max(y, bottom));
    const transition = document.startViewTransition(() => toggleTheme(e as any) );
    transition.ready.then(() => {
        document.documentElement.animate(
            [ { clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${radius}px at ${x}px ${y}px)` } ],
            { duration: 750, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" }
        );
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setIsDraggingVisual(false); 
    (e.target as Element).releasePointerCapture((e as any).pointerId);

    const overZone = Math.hypot(e.clientX - (window.innerWidth / 2), e.clientY - (window.innerHeight - 80)) < 120;
    setIsOverDropZone(false);

    if (overZone) {
        localStorage.setItem('capy_theme_caged', 'true');
        window.dispatchEvent(new Event('cage_update')); // Notify Robot!
        return; 
    }

    setShowTooltip(true);
    if (buttonRef.current) buttonRef.current.style.cursor = 'grab';
    localStorage.setItem('witchPos', JSON.stringify(pos.current));

    if (isClick.current) { vel.current = { x: 0, y: 0 }; handleTransition(e); }
  };

  const handleRelease = () => {
      // Clear BOTH cages! Jailbreak!
      localStorage.removeItem('capy_robot_caged');
      localStorage.removeItem('capy_theme_caged');
      window.dispatchEvent(new Event('cage_update'));
  };

  return (
    <>
      {/* ✅ FASTER, SMALLER DROP ZONE */}
      <AnimatePresence>
        {isDraggingVisual && (
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.8, x: '-50%' }} // Reduced drop distance
            animate={{ y: 0, opacity: 1, scale: isOverDropZone ? 1.1 : 1, x: '-50%' }}
            exit={{ y: 100, opacity: 0, scale: 0.8, x: '-50%' }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }} // Snaps instantly
            className={`fixed bottom-6 left-1/2 z-[9999] px-6 py-4 rounded-t-3xl rounded-b-xl flex flex-col items-center justify-center gap-1 shadow-2xl border-2 pointer-events-none ${ // Smaller padding and gap
              isOverDropZone 
                ? 'bg-amber-500/20 backdrop-blur-md border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.6)]' 
                : 'bg-zinc-900/80 backdrop-blur-md border-zinc-600'
            }`}
          >
            <CageIcon isOpen={isOverDropZone} className={`w-8 h-8 transition-colors duration-200 ${isOverDropZone ? 'text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]' : 'text-zinc-400'}`} /> {/* Smaller icon */}
            <span className={`font-black tracking-widest text-[10px] uppercase whitespace-nowrap transition-colors duration-200 ${isOverDropZone ? 'text-amber-200' : 'text-zinc-400'}`}>
              {isOverDropZone ? 'Release to Trap' : 'Drag to Cage'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔒 THE MASTER CAGE */}
      {isCapyCaged && (
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
              Free {isRobotCaged ? 'us' : 'me'}! 🥺
            </div>
            <div className="relative w-full h-full flex items-center justify-center">
              {/* CAPYBARA: Sits center if alone, right if sharing */}
              <img src={capybara} className={`absolute bottom-3 ${isRobotCaged ? 'right-2' : 'left-1/2 -translate-x-1/2'} w-11 h-11 object-contain z-10 opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300 transform -scale-x-100`} />
              <CageIcon isOpen={false} className="absolute inset-0 w-full h-full text-zinc-500 z-20 transition-colors group-hover:text-amber-400" />
            </div>
         </motion.button>
      )}

      {/* 🐾 THE FREE-WANDERING STATE */}
      {!isCapyCaged && (
        <button
          ref={buttonRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onMouseEnter={() => setShowTooltip(true)}
          className="fixed top-0 left-0 z-[9998] group cursor-grab touch-none select-none outline-none"
          style={{ willChange: 'transform', width: FAIRY_SIZE, height: FAIRY_SIZE }}
          aria-label="Theme Toggle"
        >
          <div 
            className={`
                absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap
                px-4 py-2 rounded-2xl text-xs font-bold shadow-xl
                bg-white dark:bg-gray-800 text-gray-800 dark:text-white
                border border-gray-100 dark:border-gray-700
                transition-all duration-300 transform origin-bottom z-50 pointer-events-none
                ${showTooltip && !isDraggingVisual ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-50 translate-y-4'}
            `}
          >
              <span className="font-mono">{displayedText}</span>
              <span className="animate-pulse text-indigo-500 font-bold ml-1">|</span> 
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-gray-800 rotate-45 border-r border-b border-gray-100 dark:border-gray-700"></div>
          </div>

          <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
            <div className={`
                absolute inset-0 rounded-full blur-xl opacity-60 transition-colors duration-500
                ${theme === 'light' ? 'bg-yellow-400' : 'bg-purple-600'}
            `} />

            <div className="relative z-10 w-full h-full drop-shadow-xl transform transition-transform group-hover:scale-110">
                <img 
                    src={capybara} 
                    alt="Capybara Theme Toggle" 
                    className="w-full h-full object-contain pointer-events-none transform -scale-x-100"
                    draggable={false}
                />
            </div>
          </div>
        </button>
      )}
    </>
  );
};
export default FloatingThemeToggle;