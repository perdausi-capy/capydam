import { createContext, useContext, useState, type ReactNode, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';

type CommandHandler = (args: string[]) => void;

interface TerminalContextType {
  logs: string[];
  addLog: (msg: string) => void;
  registerCommand: (cmd: string, handler: CommandHandler) => void;
  unregisterCommand: (cmd: string) => void;
  executeCommand: (input: string) => void;
  // ✅ UI State moved here
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isFloating: boolean;
  setIsFloating: (floating: boolean) => void;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export const TerminalProvider = ({ children }: { children: ReactNode }) => {
  const [logs, setLogs] = useState<string[]>([
    '> CAPYDAM_OS v2.0 INITIATED...', 
    '> SYSTEM READY.',
    '> TYPE "help" FOR MANIFEST.'
  ]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFloating, setIsFloating] = useState(false); // ✅ Moved from Component to Context
  const [commands, setCommands] = useState<Record<string, CommandHandler>>({});

  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, msg]);
  }, []);

  const registerCommand = useCallback((cmd: string, handler: CommandHandler) => {
    setCommands(prev => ({ ...prev, [cmd]: handler }));
  }, []);

  const unregisterCommand = useCallback((cmd: string) => {
    setCommands(prev => {
      if (!prev[cmd]) return prev;
      const newCmds = { ...prev };
      delete newCmds[cmd];
      return newCmds;
    });
  }, []);

  const executeCommandWithState = useCallback((input: string) => {
     const trimmed = input.trim();
     if (!trimmed) return;
     
     addLog(`root@capydam:~$ ${trimmed}`);
     const [cmd, ...args] = trimmed.toLowerCase().split(' ');

     // 1. PAGE SPECIFIC COMMANDS (Priority)
     if (commands[cmd]) {
       commands[cmd](args);
       return;
     } 

     // 2. GLOBAL COMMANDS (Centralized Logic)
     switch(cmd) {
        // --- NAVIGATION ---
        case 'goto':
        case 'cd':
           const target = args[0];
           if (!target) { addLog('> ERROR: MISSING DESTINATION.'); break; }
           
           const routes: Record<string, string> = {
               'home': '/',
               'library': '/library',
               'dashboard': '/library',
               'files': '/library',
               'users': '/users',
               'upload': '/upload',
               'collections': '/collections',
               'support': '/support',
               'profile': `/profile/${user?.id || ''}`,
               'analytics': '/admin/analytics',
               'feedback': '/admin/feedback'
           };

           if (routes[target]) {
               addLog(`> NAVIGATING TO ${target.toUpperCase()}...`);
               navigate(routes[target]);
           } else {
               addLog(`> ERROR: DIRECTORY "${target}" NOT FOUND.`);
           }
           break;

        case 'open':
           if (!args[0]) { addLog('> USAGE: open [asset_id]'); break; }
           addLog(`> OPENING ASSET ${args[0]}...`);
           navigate(`/assets/${args[0]}`);
           break;

        // --- UI CONTROL ---
        case 'float':
        case 'minimize':
           setIsFloating(true);
           addLog('> TERMINAL DETACHED. GLOBAL MODE ENABLED.');
           break;

        case 'dock':
        case 'maximize':
           setIsFloating(false);
           addLog('> TERMINAL DOCKED.');
           break;

        // --- SYSTEM ---
        case 'theme':
           if (args[0] === 'dark') {
               if (theme === 'light') toggleTheme();
               addLog('> SYSTEM THEME SET TO: DARK MODE');
           } else if (args[0] === 'light') {
               if (theme === 'dark') toggleTheme();
               addLog('> SYSTEM THEME SET TO: LIGHT MODE');
           } else {
               toggleTheme();
               addLog('> SYSTEM THEME TOGGLED.');
           }
           break;

        case 'whoami':
           addLog(`> USER: ${user?.name || 'Guest'}`);
           addLog(`> ROLE: ${user?.role || 'N/A'}`);
           addLog(`> UID:  ${user?.id || 'N/A'}`);
           break;

        case 'refresh':
           addLog('> RELOADING KERNEL...');
           window.location.reload();
           break;

        case 'logout':
        case 'exit': 
           if (args[0] === 'system') {
               addLog('> TERMINATING SESSION...');
               logout();
               navigate('/login');
           } else {
               setIsOpen(false); 
           }
           break;

        case 'clear':
        case 'cls':
           setLogs(['> CONSOLE CLEARED']);
           break;

        case 'help': 
           addLog('--- GLOBAL COMMAND MANIFEST ---');
           addLog('  goto [loc]    :: home, library, users, upload, collections, analytics');
           addLog('  open [id]     :: Open specific asset ID');
           addLog('  theme [mode]  :: Toggle dark/light mode');
           addLog('  float / dock  :: Toggle window mode');
           addLog('  whoami        :: Display current user session info');
           addLog('  clear         :: Clear terminal buffer');
           
           const pageCmds = Object.keys(commands);
           if (pageCmds.length > 0) {
               addLog(' ');
               addLog(`--- ACTIVE PAGE EXTENSIONS ---`);
               addLog(`  ${pageCmds.join(', ')}`);
           }
           break;

        default: addLog(`> BASH: command not found: ${cmd}`);
     }
  }, [commands, addLog, navigate, user, logout, theme, toggleTheme, setIsOpen, setIsFloating]);

  const value = useMemo(() => ({
    logs,
    addLog,
    registerCommand,
    unregisterCommand,
    executeCommand: executeCommandWithState,
    isOpen,
    setIsOpen,
    isFloating,
    setIsFloating
  }), [logs, addLog, registerCommand, unregisterCommand, executeCommandWithState, isOpen, isFloating]);

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
};

export const useTerminal = () => {
  const context = useContext(TerminalContext);
  if (!context) throw new Error('useTerminal must be used within a TerminalProvider');
  return context;
};