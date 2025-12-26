import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTerminal } from '../context/TerminalContext';
import { useAuth } from '../context/AuthContext'; 
import { Terminal, Minimize2, Maximize2, X } from 'lucide-react';
import { motion } from 'framer-motion';

const GlobalTerminal = () => {
  // ✅ Consume all state from Context
  const { logs, executeCommand, isOpen, setIsOpen, isFloating, setIsFloating, addLog } = useTerminal();
  const { user } = useAuth();
  
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // ✅ 1. Auto-Visibility Logic (Only logic remaining in UI)
  useEffect(() => {
    if (location.pathname === '/admin/analytics') {
        if (!isOpen) setIsOpen(true);
    } else {
        // If not floating (Global Mode), close when leaving analytics
        if (!isFloating && isOpen) {
            setIsOpen(false);
        }
    }
  }, [location.pathname, isFloating, setIsOpen, isOpen]);

  // ✅ 2. Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs, isFloating, isOpen]);

  // ✅ 3. History Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setInput(history[history.length - 1 - newIndex]);
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setInput(history[history.length - 1 - newIndex]);
        } else {
            setHistoryIndex(-1);
            setInput('');
        }
    } else if (e.key === 'Enter') {
        const trimmed = input.trim();
        if (trimmed) {
            setHistory(prev => [...prev, trimmed]);
            setHistoryIndex(-1);
            executeCommand(trimmed); // Send to Context
            setInput('');
        }
    }
  };

  // ✅ 4. Render Logic
  if (user?.role !== 'admin') return null;
  if (!isOpen) return null;

  return (
    <motion.div 
      layout
      initial={false}
      animate={isFloating ? "floating" : "docked"}
      variants={{
        docked: { position: 'fixed', bottom: 0, left: 0, right: 0, height: '30vh', width: '100%', borderRadius: 0 },
        floating: { position: 'fixed', bottom: 20, right: 20, height: 350, width: 450, borderRadius: 12 }
      }}
      className="bg-[#1a1a1a] dark:bg-[#050505]/95 border-t border-gray-600 dark:border-green-500 p-4 flex flex-col font-mono text-sm z-50 shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-2 select-none">
        <div className="flex items-center gap-2">
            <Terminal size={14} className="text-green-500" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {isFloating ? 'Global Shell' : 'Analytics Console'}
            </span>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => {
                    const newState = !isFloating;
                    setIsFloating(newState);
                    addLog(newState ? '> WINDOW DETACHED.' : '> WINDOW DOCKED.');
                }} 
                className="text-gray-400 hover:text-white"
            >
                {isFloating ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-red-500">
                <X size={14} />
            </button>
        </div>
      </div>

      {/* Logs */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto mb-2 custom-scrollbar">
        {logs.map((log, i) => (
          <div key={i} className="text-gray-300 dark:text-green-400/90 whitespace-pre-wrap leading-tight">{log}</div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2">
        <span className="font-bold shrink-0 text-white dark:text-green-500">root@capydam:~$</span>
        <input 
          autoFocus
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent border-none outline-none text-white dark:text-green-100 font-mono"
          spellCheck={false}
        />
      </div>
    </motion.div>
  );
};

export default GlobalTerminal;