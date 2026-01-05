import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

export interface Reaction {
    id: string;
    emoji: string;
    userId: string;
    user: { id: string; name: string; };
}

export interface Message {
  id: string; content: string; userId: string;
  user: { name: string; avatar?: string; };
  createdAt?: string; updatedAt?: string;
  attachmentUrl?: string; attachmentType?: string; attachmentName?: string;
  reactions?: Reaction[];
  roomId: string; 
  _count?: { replies: number };
}

export interface Thread {
    id: string; 
    replies: Message[];
}

export interface UserData { id: string; name: string; avatar?: string; }
export interface OnlineUser { userId: string; name: string; avatar?: string; }
export interface Channel { id: string; name: string; type: 'channel' | 'group' | 'dm'; members?: UserData[]; unreadCount?: number; } 
export interface ActiveDM { roomId: string; userId: string; name: string; avatar?: string; }

export const useChat = () => {
  const { socket } = useSocket();
  const { user } = useAuth();

  // 1. STATE
  const [activeRoom, setActiveRoom] = useState<string>(() => localStorage.getItem('capychat_activeRoom') || '');
  
  const [activeDM, setActiveDM] = useState<ActiveDM | null>(() => {
      const saved = localStorage.getItem('capychat_activeDM');
      return saved ? JSON.parse(saved) : null;
  });

  const [activeDMs, setActiveDMs] = useState<ActiveDM[]>(() => {
      const saved = localStorage.getItem('capychat_activeDM');
      return saved ? [JSON.parse(saved)] : [];
  });

  const [channels, setChannels] = useState<Channel[]>([]);
  
  // CACHING STATE
  const [messageCache, setMessageCache] = useState<Record<string, Message[]>>({});
  const [hasMoreCache, setHasMoreCache] = useState<Record<string, boolean>>({});

  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false); 
  const [isSending, setIsSending] = useState(false);

  // Refs
  const onlineUsersRef = useRef<OnlineUser[]>([]);
  const allUsersRef = useRef<UserData[]>([]); // ✅ FIXED: Added this missing ref
  const activeRoomRef = useRef(activeRoom);
  const channelsRef = useRef(channels);
  const processedMessageIds = useRef<Set<string>>(new Set());
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onlineUsersRef.current = onlineUsers; }, [onlineUsers]);
  useEffect(() => { allUsersRef.current = allUsers; }, [allUsers]);
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
  useEffect(() => { channelsRef.current = channels; }, [channels]);

  // Derived State
  const messages = useMemo(() => messageCache[activeRoom] || [], [messageCache, activeRoom]);
  const hasMore = useMemo(() => hasMoreCache[activeRoom] ?? true, [hasMoreCache, activeRoom]);

  // Persistence
  useEffect(() => {
      localStorage.setItem('capychat_activeRoom', activeRoom);
      if (activeDM) localStorage.setItem('capychat_activeDM', JSON.stringify(activeDM));
      else localStorage.removeItem('capychat_activeDM');
  }, [activeRoom, activeDM]);

  // Self Healing
  useEffect(() => {
      if (!isLoadingChannels && channels.length > 0) {
          const isValidChannel = channels.some(c => c.name === activeRoom || c.id === activeRoom);
          const isValidDM = activeDMs.some(dm => dm.roomId === activeRoom) || (activeDM && activeDM.roomId === activeRoom);

          if (activeRoom && !isValidChannel && !isValidDM) {
              console.warn(`Redirecting from invalid room "${activeRoom}"`);
              const firstChannel = channels.find(c => c.type === 'channel');
              if (firstChannel) setActiveRoom(firstChannel.name);
              else setActiveRoom('');
          }
      }
  }, [channels, activeDMs, activeDM, isLoadingChannels, activeRoom]);

  // Room Switching Logic
  useEffect(() => {
      if (socket && activeRoom && !isLoadingChannels) {
          console.log(`🔌 Switching to: ${activeRoom}`);
          setIsThreadOpen(false);
          setActiveThread(null);

          // Only show loader if we don't have cached messages
          if (!messageCache[activeRoom] || messageCache[activeRoom].length === 0) {
              setIsLoadingMessages(true);
          } else {
              setIsLoadingMessages(false);
          }

          socket.emit('join_room', activeRoom);
      }
  }, [socket, activeRoom, isLoadingChannels]); // removed messageCache dep

  useEffect(() => {
    if (!socket || !user) return;

    socket.emit('register_user', { userId: user.id, name: user.name, avatar: user.avatar });
    socket.emit('fetch_all_users'); 
    
    const handleUpdateChannelList = (list: Channel[]) => {
        setChannels(prevChannels => list.map(newChannel => {
            const localChannel = prevChannels.find(c => c.id === newChannel.id);
            if (localChannel?.members && (!newChannel.members || newChannel.members.length === 0)) {
                return { ...newChannel, members: localChannel.members };
            }
            return newChannel;
        }));
        setIsLoadingChannels(false);
    };

    const isMessageForCurrentRoom = (msgRoomId: string) => {
        const current = activeRoomRef.current;
        if (current === msgRoomId) return true;
        const channel = channelsRef.current.find(c => c.name === current);
        if (channel && channel.id === msgRoomId) return true;
        return false;
    };

    const handleReceiveMessage = (message: Message) => {
        if (!isMessageForCurrentRoom(message.roomId)) {
            setChannels(prev => prev.map(c => {
                if (c.id === message.roomId || c.name === message.roomId) {
                    const currentCount = c.unreadCount || 0;
                    return { ...c, unreadCount: currentCount + 1 };
                }
                return c;
            }));
        }

        if (message.userId === user.id) {
            setIsSending(false);
            if (sendingTimeoutRef.current) clearTimeout(sendingTimeoutRef.current);
        }

        setTypingUsers((prev) => { const s = new Set(prev); s.delete(message.user.name); return s; });

        // Update Cache
        const channelName = channelsRef.current.find(c => c.id === message.roomId)?.name;
        const keysToUpdate = [message.roomId];
        if (channelName) keysToUpdate.push(channelName);

        setMessageCache(prev => {
            const next = { ...prev };
            keysToUpdate.forEach(key => {
                const currentList = next[key] || [];
                if (!currentList.some(m => m.id === message.id)) {
                    next[key] = [...currentList, message];
                }
            });
            return next;
        });
    };

    const handleLoadHistory = (history: Message[]) => {
        if (history.length === 0) { setIsLoadingMessages(false); return; }
        
        const msgRoomId = history[0].roomId;
        const channelName = channelsRef.current.find(c => c.id === msgRoomId)?.name;
        const activeKey = activeRoomRef.current;
        
        if (activeKey === msgRoomId || activeKey === channelName) setIsLoadingMessages(false);

        setMessageCache(prev => {
            const next = { ...prev };
            const keys = [msgRoomId];
            if (channelName) keys.push(channelName);

            keys.forEach(key => {
                next[key] = history;
            });
            return next;
        });

        setHasMoreCache(prev => {
            const next = { ...prev };
            const hasMore = history.length === 50;
            if (channelName) next[channelName] = hasMore;
            next[msgRoomId] = hasMore;
            return next;
        });
    };

    const handleHistoryChunk = (olderMessages: Message[]) => {
        setIsFetchingHistory(false);
        if (olderMessages.length === 0) return;

        const msgRoomId = olderMessages[0].roomId;
        const channelName = channelsRef.current.find(c => c.id === msgRoomId)?.name;

        setMessageCache(prev => {
            const next = { ...prev };
            const keys = [msgRoomId];
            if (channelName) keys.push(channelName);

            keys.forEach(key => {
                const current = next[key] || [];
                const uniqueNew = olderMessages.filter(nm => !current.some(cm => cm.id === nm.id));
                next[key] = [...uniqueNew, ...current];
            });
            return next;
        });

        setHasMoreCache(prev => {
            const next = { ...prev };
            const hasMore = olderMessages.length === 50;
            if (channelName) next[channelName] = hasMore;
            next[msgRoomId] = hasMore;
            return next;
        });
    };

    const handleUpdateOnlineUsers = (users: OnlineUser[]) => setOnlineUsers(Array.from(new Map(users.map(u => [u.userId, u])).values()));
    const handleReceiveAllUsers = (users: UserData[]) => setAllUsers(users);

    const handleDMStarted = (data: { roomId: string, otherUser?: OnlineUser, targetUserId?: string }) => {
        let target = data.otherUser;
        if (!target && data.targetUserId) {
             const online = onlineUsersRef.current.find(u => u.userId === data.targetUserId);
             target = online || allUsersRef.current.find(u => u.id === data.targetUserId) as any;
        }
        if (!target) return;
        const newDM: ActiveDM = { roomId: data.roomId, userId: target.userId || (target as any).id, name: target.name, avatar: target.avatar };
        setActiveDMs(prev => { if (prev.some(dm => dm.roomId === newDM.roomId)) return prev; return [...prev, newDM]; });
        setActiveRoom(newDM.roomId); setActiveDM(newDM); 
        
        if (!messageCache[newDM.roomId]) setIsLoadingMessages(true);
        socket.emit('join_room', data.roomId);
    };

    const handleKicked = (data: { roomId: string, name: string }) => {
        toast.error(`You have been removed from ${data.name}`, { position: 'top-right' });
        setActiveRoom(prev => (prev === data.name || prev === data.roomId) ? '' : prev);
    };

    const handleMessageUpdated = (updatedMsg: Message) => {
        setMessageCache(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(key => {
                if (next[key]) {
                    next[key] = next[key].map(m => m.id === updatedMsg.id ? updatedMsg : m);
                }
            });
            return next;
        });

        setActiveThread(prev => {
            if (!prev) return null;
            if (prev.id === updatedMsg.id) return { ...prev, ...updatedMsg, replies: prev.replies };
            const isReply = prev.replies.some(r => r.id === updatedMsg.id);
            if (isReply) return { ...prev, replies: prev.replies.map(r => r.id === updatedMsg.id ? updatedMsg : r) };
            return prev;
        });
    };

    const handleLoadThreadMessages = (replies: Message[]) => setActiveThread(prev => prev ? { ...prev, replies } : null);
    
    const handleReceiveThreadMessage = (reply: Message) => {
        setActiveThread(prev => {
            if (!prev || (reply as any).parentId !== prev.id) return prev;
            return { ...prev, replies: [...prev.replies, reply] };
        });
    };

    const handleThreadUpdated = (data: { parentId: string, count: number }) => {
        setMessageCache(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(key => {
                if (next[key]) {
                    next[key] = next[key].map(m => m.id === data.parentId ? { ...m, _count: { replies: data.count } } : m);
                }
            });
            return next;
        });
    };

    socket.on('update_channel_list', handleUpdateChannelList);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('load_history', handleLoadHistory);
    socket.on('history_chunk', handleHistoryChunk);
    socket.on('update_online_users', handleUpdateOnlineUsers);
    socket.on('receive_all_users', handleReceiveAllUsers);
    socket.on('dm_started', handleDMStarted);
    socket.on('kicked_from_room', handleKicked);
    socket.on('user_typing', (data) => setTypingUsers(p => new Set(p).add(data.name)));
    socket.on('message_deleted', (id) => {
        setMessageCache(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(key => {
                if (next[key]) next[key] = next[key].filter(m => m.id !== id);
            });
            return next;
        });
    });
    socket.on('message_updated', handleMessageUpdated);
    socket.on('load_thread_messages', handleLoadThreadMessages);
    socket.on('receive_thread_message', handleReceiveThreadMessage);
    socket.on('thread_updated', handleThreadUpdated);

    const interval = setInterval(() => setTypingUsers(new Set()), 5000); 
    return () => {
       socket.off('update_channel_list'); socket.off('receive_message'); socket.off('load_history');
       socket.off('history_chunk'); socket.off('update_online_users'); socket.off('receive_all_users'); 
       socket.off('dm_started'); socket.off('kicked_from_room'); socket.off('user_typing'); 
       socket.off('message_deleted'); socket.off('message_updated');
       socket.off('load_thread_messages'); socket.off('receive_thread_message'); socket.off('thread_updated');
       clearInterval(interval);
    };
  }, [socket, user, activeRoom]); 

  // --- ACTIONS (MEMOIZED) ---
  const joinRoom = useCallback((roomName: string) => {
      if (!socket) return;
      setChannels(prev => prev.map(c => c.name === roomName ? { ...c, unreadCount: 0 } : c));
      setActiveRoom(roomName); 
      setActiveDM(null);
  }, [socket]);

  const switchToDM = useCallback((dm: ActiveDM) => {
      if (!socket) return;
      setActiveRoom(dm.roomId); 
      setActiveDM(dm);
  }, [socket]);

  const loadMoreMessages = useCallback(() => {
      if (!socket || !activeRoomRef.current || isFetchingHistory || !hasMoreCache[activeRoomRef.current]) return;
      
      const currentMsgs = messageCache[activeRoomRef.current] || [];
      if (currentMsgs.length === 0) return;

      setIsFetchingHistory(true);
      socket.emit('fetch_history', { roomId: activeRoomRef.current, cursor: currentMsgs[0].id });
  }, [socket, isFetchingHistory, messageCache, hasMoreCache]);

  const startDM = useCallback((targetUserId: string) => { 
      if (socket && user && targetUserId !== user.id) socket.emit('start_dm', targetUserId); 
  }, [socket, user]);

  const createChannel = useCallback((name: string) => { 
      if (!name.trim() || !socket) return; 
      socket.emit('create_channel', name.toLowerCase().replace(/\s+/g, '-')); 
  }, [socket]);

  const createGroup = useCallback((name: string) => { 
      if (!name.trim() || !socket) return; 
      socket.emit('create_group', { name }); 
  }, [socket]);
  
  const deleteChannel = useCallback((channelId: string) => {
      if (!socket) return;
      socket.emit('delete_channel', channelId);
  }, [socket]);

  const addMember = useCallback((roomId: string, userId: string) => {
      if (!socket) return;
      socket.emit('add_member_to_group', { roomId, userId });
  }, [socket]);

  const kickMember = useCallback((roomId: string, userId: string) => {
      if (!socket) return;
      socket.emit('kick_member', { roomId, userId });
  }, [socket]);

  const uploadFile = async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      try {
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          if (!res.ok) throw new Error('Upload failed');
          return await res.json(); 
      } catch (error) {
          console.error("Upload error:", error);
          toast.error("Failed to upload file");
          return null;
      }
  };

  const sendMessage = useCallback(async (content: string, file?: File) => {
    if (!socket || !user || !activeRoomRef.current) return;
    
    setIsSending(true);
    if (sendingTimeoutRef.current) clearTimeout(sendingTimeoutRef.current);
    sendingTimeoutRef.current = setTimeout(() => setIsSending(false), 5000);

    socket.emit('stop_typing', activeRoomRef.current);
    let attachmentData = {};
    if (file) {
        const uploadResult = await uploadFile(file);
        if (uploadResult) attachmentData = { attachmentUrl: uploadResult.url, attachmentType: uploadResult.mimetype, attachmentName: uploadResult.filename };
        else { setIsSending(false); return; }
    }
    socket.emit('send_message', { content, userId: user.id, roomId: activeRoomRef.current, ...attachmentData });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [socket, user]);

  const sendThreadMessage = useCallback(async (content: string, parentId: string, file?: File) => {
      if (!socket || !user || !activeRoomRef.current) return;
      let attachmentData = {};
      if (file) {
          const uploadResult = await uploadFile(file);
          if (uploadResult) attachmentData = { attachmentUrl: uploadResult.url, attachmentType: uploadResult.mimetype, attachmentName: uploadResult.filename };
          else return; 
      }
      socket.emit('send_thread_message', { content, userId: user.id, roomId: activeRoomRef.current, parentId, ...attachmentData });
  }, [socket, user]);

  const sendTyping = useCallback(() => {
      if(!socket || !user || !activeRoomRef.current) return;
      socket.emit('typing', { roomId: activeRoomRef.current, name: user.name });
      if(typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => socket.emit('stop_typing', activeRoomRef.current), 2000);
  }, [socket, user]);

  const deleteMessage = useCallback((id: string) => socket?.emit('delete_message', id), [socket]);
  const editMessage = useCallback((id: string, newContent: string) => socket?.emit('edit_message', { messageId: id, newContent }), [socket]);
  const addReaction = useCallback((messageId: string, emoji: string) => { if (socket && activeRoomRef.current) socket.emit('add_reaction', { messageId, emoji, roomId: activeRoomRef.current }); }, [socket]);
  const removeReaction = useCallback((messageId: string, emoji: string) => { if (socket && activeRoomRef.current) socket.emit('remove_reaction', { messageId, emoji, roomId: activeRoomRef.current }); }, [socket]);
  
  const openThread = useCallback((message: Message) => { 
      setIsThreadOpen(true); 
      setActiveThread({ id: message.id, replies: [] }); 
      socket?.emit('join_thread', message.id); 
  }, [socket]);
  
  const closeThread = useCallback(() => { 
      if (activeThread) socket?.emit('leave_thread', activeThread.id); 
      setIsThreadOpen(false); 
      setActiveThread(null); 
  }, [socket, activeThread]);

  return {
    user, activeRoom, activeDM, channels, activeDMs, messages, 
    onlineUsers, allUsers, isLoadingChannels, isLoadingMessages, isSending, typingUsers,
    isFetchingHistory, hasMore, loadMoreMessages,
    joinRoom, switchToDM, startDM, createChannel, createGroup, deleteChannel,
    addMember, kickMember, sendMessage, sendTyping, deleteMessage, editMessage,
    addReaction, removeReaction, activeThread, isThreadOpen, openThread, closeThread, sendThreadMessage
  };
};