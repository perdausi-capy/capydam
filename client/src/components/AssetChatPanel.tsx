import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, AlertCircle } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

interface AssetChatPanelProps {
  assetId: string;
}

interface Message {
  id: string;
  content: string;
  userId: string;
  user: {
    name: string;
    avatar?: string;
  };
  createdAt?: string;
}

const formatTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    const date = new Date(isoString);
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (date.toDateString() === new Date().toDateString()) return timeStr;
    return `${date.toLocaleDateString()} ${timeStr}`;
};

const AssetChatPanel: React.FC<AssetChatPanelProps> = ({ assetId }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Unique Room ID for this specific asset
  const roomId = `asset-${assetId}`;
  
  const processedMessageIds = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- SOCKET LOGIC ---
  useEffect(() => {
    if (!socket || !assetId) return;

    console.log(`🔌 [AssetChat] Joining room: ${roomId}`);
    
    // 1. Join this specific asset's room
    socket.emit('join_room', roomId);

    // 2. Clear previous messages when switching assets
    setMessages([]);
    processedMessageIds.current.clear();

    const handleReceiveMessage = (message: Message) => {
        // Only accept messages for this room (Basic client-side filtering)
        // ideally backend handles this via rooms, but safety first
        if (processedMessageIds.current.has(message.id)) return;
        
        processedMessageIds.current.add(message.id);
        setMessages((prev) => [...prev, message]);
    };

    const handleLoadHistory = (history: Message[]) => {
        console.log(`📚 [AssetChat] Loaded ${history.length} messages`);
        processedMessageIds.current.clear();
        history.forEach(m => processedMessageIds.current.add(m.id));
        setMessages(history);
        setTimeout(scrollToBottom, 100);
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('load_history', handleLoadHistory);

    return () => {
      console.log(`🛑 [AssetChat] Leaving room: ${roomId}`);
      // Optional: You could emit a 'leave_room' event if your backend supported it, 
      // but Socket.io handles disconnects/room switching automatically on the server side mostly.
      socket.off('receive_message', handleReceiveMessage);
      socket.off('load_history', handleLoadHistory);
    };
  }, [socket, assetId, roomId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !user) return;

    const messageData = {
      content: newMessage,
      userId: user.id,
      roomId: roomId, // ✅ SEND TO ASSET ROOM
    };

    socket.emit('send_message', messageData);
    setNewMessage('');
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1A1D21] border-l border-gray-200 dark:border-white/5">
      
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between shrink-0">
         <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-600 dark:text-blue-400"/>
            Comments
         </h3>
         <span className="text-xs text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-full">
            {messages.length}
         </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-center text-gray-400">
                <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-2">
                    <MessageSquare size={20} />
                </div>
                <p className="text-sm">No comments yet.</p>
                <p className="text-xs opacity-70">Be the first to give feedback!</p>
            </div>
        )}

        {messages.map((msg, i) => {
             const isMe = msg.userId === user.id;
             const isSameUser = i > 0 && messages[i - 1].userId === msg.userId;

             return (
                 <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                     
                     {/* Name & Time (If not same user) */}
                     {!isSameUser && (
                         <div className="flex items-center gap-2 mb-1 px-1">
                             <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                 {isMe ? 'You' : msg.user.name}
                             </span>
                             <span className="text-[10px] text-gray-400">
                                 {formatTime(msg.createdAt)}
                             </span>
                         </div>
                     )}

                     {/* Bubble */}
                     <div className={`
                        px-3 py-2 rounded-2xl text-sm break-words max-w-[90%] shadow-sm
                        ${isMe 
                            ? 'bg-blue-600 text-white rounded-tr-sm' 
                            : 'bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-gray-200 border border-transparent dark:border-white/10 rounded-tl-sm'
                        }
                     `}>
                        {msg.content}
                     </div>
                 </div>
             );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#15171B] shrink-0">
         <div className="flex gap-2">
            <input 
                type="text" 
                placeholder="Write a comment..." 
                className="flex-1 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
            />
            <button 
                type="submit" 
                disabled={!newMessage.trim()}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <Send size={16} />
            </button>
         </div>
         <div className="mt-2 text-[10px] text-center text-gray-400 flex items-center justify-center gap-1">
            <AlertCircle size={10} />
            Comments are visible to everyone with access.
         </div>
      </form>

    </div>
  );
};

export default AssetChatPanel;