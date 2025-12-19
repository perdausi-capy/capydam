import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext'; 
import Lottie from "lottie-react";

// ✅ Import your animation
import WitchAnimation from '../assets/witch.json';

// --- CONFIGURATION ---
const FAIRY_SIZE = 80;
const DAMPING = 0.95; 
const MAX_VELOCITY = 15;
const WANDER_STRENGTH = 0.05; 

const FloatingThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // --- UI STATE ---
  const [showTooltip, setShowTooltip] = useState(true);
  const [displayedText, setDisplayedText] = useState("");
  const [reaction, setReaction] = useState<string | null>(null);
  const isFirstRender = useRef(true); 

  // --- PHYSICS STATE ---
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

  // --- REACTION EFFECT ---
  useEffect(() => {
    if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
    }
    // Fun reaction text based on theme
    const reactionText = theme === 'dark' ? "Sheesh! 🥶" : "Bright moves! 😎";
    setReaction(reactionText);
    setShowTooltip(true);
    const timer = setTimeout(() => setReaction(null), 3000);
    return () => clearTimeout(timer);
  }, [theme]);

  // --- TYPEWRITER EFFECT ---
  useEffect(() => {
    const defaultText = theme === 'light' 
        ? "Too bright? Click me! ✨" 
        : "Too dark? Click me! 🌙";
    
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
  }, [showTooltip, theme, reaction]); 

  // --- PHYSICS LOOP ---
  const update = useCallback(() => {
    if (!buttonRef.current) return;

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
        
        if (speed > 0.5) {
            vel.current.x *= DAMPING;
            vel.current.y *= DAMPING;
        } else {
            const time = Date.now() / 1000 + timeOffset.current;
            vel.current.x += Math.sin(time * 2) * WANDER_STRENGTH;
            vel.current.y += Math.cos(time * 1.5) * WANDER_STRENGTH;
        }
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
    isClick.current = true;
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

  // ✅ THE SPECIAL SAUCE: CIRCULAR REVEAL LOGIC
  const handleTransition = async (e: React.MouseEvent) => {
    // 1. If browser doesn't support it, just toggle normally
    if (!document.startViewTransition) {
        toggleTheme(e);
        return;
    }

    // 2. Calculate the "Explosion" math
    // We want the circle to start from the center of the Witch (pos.current)
    const x = pos.current.x + FAIRY_SIZE / 2;
    const y = pos.current.y + FAIRY_SIZE / 2;

    // Calculate distance to furthest corner so the circle covers entire screen
    const right = window.innerWidth - x;
    const bottom = window.innerHeight - y;
    const radius = Math.hypot(Math.max(x, right), Math.max(y, bottom));

    // 3. Start the Transition
    const transition = document.startViewTransition(() => {
        toggleTheme(e); // React updates the DOM here
    });

    // 4. Animate the Circle Clip Path
    transition.ready.then(() => {
        document.documentElement.animate(
            [
                { clipPath: `circle(0px at ${x}px ${y}px)` },
                { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
            ],
            {
                duration: 750, // Matches CSS
                easing: "ease-in-out",
                pseudoElement: "::view-transition-new(root)",
            }
        );
    });
  };

  const handlePointerUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    (e.target as Element).releasePointerCapture((e as any).pointerId);

    setShowTooltip(true);
    if (buttonRef.current) buttonRef.current.style.cursor = 'grab';
    localStorage.setItem('witchPos', JSON.stringify(pos.current));

    if (isClick.current) {
        vel.current = { x: 0, y: 0 };
        // ✅ Call the new Transition Handler instead of direct toggle
        handleTransition(e);
    }
  };

  return (
    <button
      ref={buttonRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onMouseEnter={() => setShowTooltip(true)}
      className="fixed top-0 left-0 z-[9999] group cursor-grab touch-none select-none outline-none"
      style={{ willChange: 'transform', width: FAIRY_SIZE, height: FAIRY_SIZE }}
      aria-label="Theme Toggle"
    >
      {/* TOOLTIP */}
      <div 
        className={`
            absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap
            px-4 py-2 rounded-2xl text-xs font-bold shadow-xl
            bg-white dark:bg-gray-800 text-gray-800 dark:text-white
            border border-gray-100 dark:border-gray-700
            transition-all duration-300 transform origin-bottom z-50 pointer-events-none
            ${showTooltip ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-50 translate-y-4'}
        `}
      >
          <span className="font-mono">{displayedText}</span>
          <span className="animate-pulse text-indigo-500 font-bold ml-1">|</span> 
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-gray-800 rotate-45 border-r border-b border-gray-100 dark:border-gray-700"></div>
      </div>

      <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
        {/* Glow */}
        <div className={`
            absolute inset-0 rounded-full blur-xl opacity-60 transition-colors duration-500
            ${theme === 'light' ? 'bg-yellow-400' : 'bg-purple-600'}
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