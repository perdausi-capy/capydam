import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext'; 
import Lottie from "lottie-react";

// Import your animation
import WitchAnimation from '../assets/witch.json';

const FAIRY_SIZE = 80;
const WANDER_SPEED = 1.5; // Calm speed
const FLUTTER_SPEED = 0.15; 

const FloatingThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // --- STATE ---
  const [showTooltip, setShowTooltip] = useState(true);
  const [displayedText, setDisplayedText] = useState("");
  
  // Reaction State (The "Sheesh" message)
  const [reaction, setReaction] = useState<string | null>(null);
  const isFirstRender = useRef(true); 

  // Physics State
  const pos = useRef({ x: 100, y: 100 });
  const vel = useRef({ x: WANDER_SPEED, y: WANDER_SPEED });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const animationFrame = useRef<number>(0);
  const timeOffset = useRef(Math.random() * 100);

  // --- 1. REACTION LOGIC (Restored!) ---
  useEffect(() => {
    // Skip the first render (don't react on page load)
    if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
    }

    // Determine Reaction Text
    const reactionText = theme === 'dark' 
        ? "Sheesh! 🥶" 
        : "Eyy, it's bright now! 😎";

    // Show Reaction
    setReaction(reactionText);
    setShowTooltip(true);

    // Clear after 3 seconds
    const timer = setTimeout(() => {
        setReaction(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [theme]);

  // --- 2. INFINITE TYPEWRITER LOOP ---
  useEffect(() => {
    // Priority: Reaction > Default Help Text
    const defaultText = theme === 'light' 
        ? "Too bright? Hold & release me! ✨" 
        : "Too dark? Hold & release me! 🌙";
    
    const targetText = reaction || defaultText;

    if (!showTooltip) {
        setDisplayedText("");
        return;
    }

    let timeout: ReturnType<typeof setTimeout>;
    let charIndex = 0;

    const typeLoop = () => {
        setDisplayedText(targetText.slice(0, charIndex));
        charIndex++;

        if (charIndex <= targetText.length) {
            timeout = setTimeout(typeLoop, 50); 
        } else {
            // Finished typing one sentence
            
            // If it's a reaction, just hold it (don't loop/delete)
            if (reaction) return;

            // If it's default text, wait 3s then restart
            timeout = setTimeout(() => {
                charIndex = 0;
                setDisplayedText(""); 
                timeout = setTimeout(typeLoop, 500); 
            }, 3000);
        }
    };

    typeLoop();

    return () => clearTimeout(timeout);
  }, [showTooltip, theme, reaction]); 

  // Initialize random position
  useEffect(() => {
    pos.current = { 
        x: Math.random() * (window.innerWidth - FAIRY_SIZE), 
        y: Math.random() * (window.innerHeight - FAIRY_SIZE) 
    };
  }, []);

  // --- PHYSICS ENGINE ---
  const update = useCallback(() => {
    if (!buttonRef.current) return;

    if (!isDragging.current) {
        const time = Date.now() / 1000 + timeOffset.current;
        const flutterX = Math.sin(time * 5) * FLUTTER_SPEED;
        const flutterY = Math.cos(time * 3) * FLUTTER_SPEED;

        vel.current.x += flutterX;
        vel.current.y += flutterY;
        
        // Clamp speed
        const speed = Math.sqrt(vel.current.x**2 + vel.current.y**2);
        if (speed > 2) {
            vel.current.x = (vel.current.x / speed) * 2;
            vel.current.y = (vel.current.y / speed) * 2;
        }

        pos.current.x += vel.current.x;
        pos.current.y += vel.current.y;

        const padding = 20;
        const maxX = window.innerWidth - FAIRY_SIZE - padding;
        const maxY = window.innerHeight - FAIRY_SIZE - padding;

        if (pos.current.x <= padding) { pos.current.x = padding; vel.current.x *= -1; } 
        else if (pos.current.x >= maxX) { pos.current.x = maxX; vel.current.x *= -1; }

        if (pos.current.y <= padding) { pos.current.y = padding; vel.current.y *= -1; } 
        else if (pos.current.y >= maxY) { pos.current.y = maxY; vel.current.y *= -1; }
    }

    buttonRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
    animationFrame.current = requestAnimationFrame(update);
  }, []);

  useEffect(() => {
    animationFrame.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame.current);
  }, [update]);

  // --- INTERACTION ---
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setShowTooltip(false);
    
    // ✅ Fix: Capture pointer so fast movements don't break drag
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
    pos.current.x = e.clientX - dragOffset.current.x;
    pos.current.y = e.clientY - dragOffset.current.y;
    
    if (buttonRef.current) {
       // Keep updating transform during drag
       buttonRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) scale(1.1)`;
    }
  };

  const handlePointerUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    // ✅ Release pointer
    (e.target as Element).releasePointerCapture((e as any).pointerId);

    setShowTooltip(true);
    if (buttonRef.current) {
        buttonRef.current.style.cursor = 'grab';
        buttonRef.current.style.transition = 'transform 0.2s ease-out';
    }
    vel.current = { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 };
  };

  const handleClick = (e: React.MouseEvent) => { toggleTheme(e); };

  return (
    <button
      ref={buttonRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onMouseEnter={() => setShowTooltip(true)}
      onClick={handleClick}
      className="fixed top-0 left-0 z-[100] group cursor-grab touch-none select-none outline-none"
      style={{ willChange: 'transform', width: FAIRY_SIZE, height: FAIRY_SIZE }}
      aria-label="Theme Toggle"
    >
      {/* SPEECH BUBBLE */}
      <div 
        className={`
            absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap
            px-4 py-2 rounded-2xl text-xs font-bold shadow-xl
            bg-white dark:bg-gray-800 text-gray-800 dark:text-white
            border border-gray-100 dark:border-gray-700
            transition-all duration-300 transform origin-bottom z-50
            ${showTooltip ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-50 translate-y-4 pointer-events-none'}
        `}
      >
          <span className="font-mono">{displayedText}</span>
          <span className="animate-pulse text-indigo-500">|</span> 
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-gray-800 rotate-45 border-r border-b border-gray-100 dark:border-gray-700"></div>
      </div>

      <div className="relative w-full h-full flex items-center justify-center">
        {/* Glow */}
        <div className={`
            absolute inset-0 rounded-full blur-xl opacity-60 transition-colors duration-500
            ${theme === 'light' ? 'bg-yellow-400' : 'bg-blue-500'}
        `} />

        {/* LOTTIE */}
        <div className="relative z-10 w-full h-full drop-shadow-xl transform transition-transform group-hover:scale-110">
            <Lottie 
                animationData={WitchAnimation} 
                loop={true} 
                className="w-full h-full"
            />
        </div>
      </div>
    </button>
  );
};

export default FloatingThemeToggle;