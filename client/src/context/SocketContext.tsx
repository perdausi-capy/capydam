import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth(); // We only connect if user is logged in

  useEffect(() => {
    if (!user) return;

    // 1. Get the API URL from env
    const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    // ✅ 2. FIX: Remove '/api' from the end of the URL
    // The previous error happened because Socket.io treated '/api' as a namespace room
    const socketUrl = rawUrl.replace(/\/api\/?$/, '');

    console.log(`🔌 [Client] Attempting to connect to: ${socketUrl}`);

    const socketInstance = io(socketUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling'], // Try WebSocket first, fall back to polling
        reconnectionAttempts: 5, // Give up after 5 tries so it doesn't spam console
    });

    // --- DEBUG EVENTS ---
    socketInstance.on('connect', () => {
      console.log('✅ [Client] Socket CONNECTED! ID:', socketInstance.id);
      setIsConnected(true);
      // Auto-join the global room
      socketInstance.emit('join_room', 'global');
    });

    socketInstance.on('connect_error', (err) => {
      console.error(`🔥 [Client] Connection Error: ${err.message}`);
      // This detail often reveals CORS issues or 404s
      console.dir(err); 
    });

    socketInstance.on('disconnect', (reason) => {
      console.warn(`⚠️ [Client] Disconnected. Reason: ${reason}`);
      setIsConnected(false);
    });
    
    // --------------------

    setSocket(socketInstance);

    return () => {
      console.log('🛑 [Client] Cleaning up socket connection...');
      socketInstance.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};