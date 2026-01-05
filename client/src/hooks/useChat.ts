import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [activeRoom, setActiveRoom] = useState<string>(() => {
      return localStorage.getItem('capychat_activeRoom') || '';
  });
  
  const [activeDM, setActiveDM] = useState<ActiveDM | null>(() => {
      const saved = localStorage.getItem('capychat_activeDM');
      return saved ? JSON.parse(saved) : null;
  });

  const [activeDMs, setActiveDMs] = useState<ActiveDM[]>(() => {
      const saved = localStorage.getItem('capychat_activeDM');
      return saved ? [JSON.parse(saved)] : [];
  });

  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const onlineUsersRef = useRef<OnlineUser[]>([]);
  const allUsersRef = useRef<UserData[]>([]);
  const activeRoomRef = useRef(activeRoom);
  const channelsRef = useRef(channels);
  const processedMessageIds = useRef<Set<string>>(new Set());
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // ✅ NEW: Safety for loader

  useEffect(() => { onlineUsersRef.current = onlineUsers; }, [onlineUsers]);
  useEffect(() => { allUsersRef.current = allUsers; }, [allUsers]);
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
  useEffect(() => { channelsRef.current = channels; }, [channels]);

  // 2. PERSISTENCE
  useEffect(() => {
      localStorage.setItem('capychat_activeRoom', activeRoom);
      if (activeDM) localStorage.setItem('capychat_activeDM', JSON.stringify(activeDM));
      else localStorage.removeItem('capychat_activeDM');
  }, [activeRoom, activeDM]);

  // 3. SELF-HEALING (Run BEFORE joining)
  useEffect(() => {
      if (!isLoadingChannels && channels.length > 0) {
          const isValidChannel = channels.some(c => c.name === activeRoom || c.id === activeRoom);
          const isValidDM = activeDMs.some(dm => dm.roomId === activeRoom) || (activeDM && activeDM.roomId === activeRoom);

          if (activeRoom && !isValidChannel && !isValidDM) {
              console.warn(`Redirecting from invalid room "${activeRoom}"`);
              const firstChannel = channels.find(c => c.type === 'channel');
              if (firstChannel) setActiveRoom(firstChannel.name);
              else if (channels.length > 0) setActiveRoom(channels[0].name);
              else setActiveRoom('');
          }
      }
  }, [channels, activeDMs, activeDM, isLoadingChannels, activeRoom]);

  // 4. ROOM JOINING (Dependent on validation)
  useEffect(() => {
      if (socket && activeRoom && !isLoadingChannels) {
          setMessages([]);
          processedMessageIds.current.clear();
          setIsLoadingMessages(true);
          
          setIsThreadOpen(false);
          setActiveThread(null);

          console.log(`🔌 Joining Room: ${activeRoom}`);
          socket.emit('join_room', activeRoom);
      }
  }, [socket, activeRoom, isLoadingChannels]); 

  useEffect(() => {
    if (!socket || !user) return;

    socket.emit('register_user', { userId: user.id, name: user.name, avatar: user.avatar });
    socket.emit('fetch_all_users'); 
    
    const handleUpdateChannelList = (list: Channel[]) => {
        setChannels(prevChannels => {
            return list.map(newChannel => {
                const localChannel = prevChannels.find(c => c.id === newChannel.id);
                if (localChannel?.members && (!newChannel.members || newChannel.members.length === 0)) {
                    return { ...newChannel, members: localChannel.members };
                }
                return newChannel;
            });
        });
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
        // ✅ 1. Unread Counts (Global)
        if (!isMessageForCurrentRoom(message.roomId)) {
            setChannels(prev => prev.map(c => {
                if (c.id === message.roomId || c.name === message.roomId) {
                    const currentCount = c.unreadCount || 0;
                    return { ...c, unreadCount: currentCount + 1 };
                }
                return c;
            }));
            return; 
        }

        // ✅ 2. Update Messages (Local)
        if (processedMessageIds.current.has(message.id)) return;
        processedMessageIds.current.add(message.id);
        setMessages((prev) => [...prev, message]);
        
        // ✅ 3. Stop Loader (Only if it's OUR message)
        if (message.userId === user.id) {
            setIsSending(false);
            if (sendingTimeoutRef.current) clearTimeout(sendingTimeoutRef.current);
        }

        setTypingUsers((prev) => { const s = new Set(prev); s.delete(message.user.name); return s; });
    };

    const handleLoadHistory = (history: Message[]) => {
        if (history.length === 0) {
            setIsLoadingMessages(false);
            return;
        }
        const msgRoomId = history[0].roomId;
        if (!isMessageForCurrentRoom(msgRoomId)) {
            console.log("Discarding history packet for wrong room:", msgRoomId);
            return;
        }

        processedMessageIds.current.clear();
        history.forEach(m => processedMessageIds.current.add(m.id));
        setMessages(history);
        setIsLoadingMessages(false);
        setHasMore(history.length === 50);
    };

    const handleHistoryChunk = (olderMessages: Message[]) => {
        if (olderMessages.length === 0) {
            setHasMore(false);
            setIsFetchingHistory(false);
            return;
        }
        const msgRoomId = olderMessages[0].roomId;
        if (!isMessageForCurrentRoom(msgRoomId)) return;

        olderMessages.forEach(m => processedMessageIds.current.add(m.id));
        setMessages(prev => [...olderMessages, ...prev]);
        setIsFetchingHistory(false);
        if (olderMessages.length < 50) setHasMore(false);
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
        setActiveRoom(newDM.roomId); setActiveDM(newDM); setIsLoadingMessages(true); setMessages([]); processedMessageIds.current.clear();
        setHasMore(true);
        socket.emit('join_room', data.roomId);
    };

    const handleKicked = (data: { roomId: string, name: string }) => {
        toast.error(`You have been removed from ${data.name}`, { position: 'top-right' });
        setActiveRoom(prev => (prev === data.name || prev === data.roomId) ? '' : prev);
        if (activeRoom === data.name) setMessages([]);
    };

    const handleMessageUpdated = (updatedMsg: Message) => {
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
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
        setMessages(prev => prev.map(m => m.id === data.parentId ? { ...m, _count: { replies: data.count } } : m));
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
    socket.on('message_deleted', (id) => setMessages(p => p.filter(m => m.id !== id)));
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

  // --- ACTIONS ---
  const joinRoom = (roomName: string) => {
      if (!socket) return;
      setChannels(prev => prev.map(c => c.name === roomName ? { ...c, unreadCount: 0 } : c));
      setActiveRoom(roomName); 
      setActiveDM(null);
  };

  const switchToDM = (dm: ActiveDM) => {
      if (!socket) return;
      setActiveRoom(dm.roomId); 
      setActiveDM(dm);
  };

  const loadMoreMessages = useCallback(() => {
      if (!socket || !activeRoom || isFetchingHistory || !hasMore || messages.length === 0) return;
      setIsFetchingHistory(true);
      socket.emit('fetch_history', { roomId: activeRoom, cursor: messages[0].id });
  }, [socket, activeRoom, isFetchingHistory, hasMore, messages]);

  const startDM = (targetUserId: string) => { if (socket && user && targetUserId !== user.id) socket.emit('start_dm', targetUserId); };
  const createChannel = (name: string) => { if (!name.trim() || !socket) return; socket.emit('create_channel', name.toLowerCase().replace(/\s+/g, '-')); };
  const createGroup = (name: string) => { if (!name.trim() || !socket) return; socket.emit('create_group', { name }); };
  
  const deleteChannel = (channelId: string) => {
      if (!socket) return;
      socket.emit('delete_channel', channelId);
      const ch = channels.find(c => c.id === channelId);
      if (activeRoom === ch?.name) { setActiveRoom(''); setMessages([]); }
  };

  const addMember = (roomId: string, userId: string) => {
      if (!socket) return;
      socket.emit('add_member_to_group', { roomId, userId });
      const userToAdd = allUsers.find(u => u.id === userId);
      if (userToAdd) {
          setChannels(prev => prev.map(ch => {
              if (ch.id === roomId) {
                  const currentMembers = ch.members || [];
                  if (!currentMembers.some(m => m.id === userId)) return { ...ch, members: [...currentMembers, userToAdd] };
              }
              return ch;
          }));
      }
  };

  const kickMember = (roomId: string, userId: string) => {
      if (!socket) return;
      socket.emit('kick_member', { roomId, userId });
      setChannels(prev => prev.map(ch => {
          if (ch.id === roomId) return { ...ch, members: ch.members?.filter(m => m.id !== userId) };
          return ch;
      }));
  };

  const uploadFile = async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
          // ✅ FIX: Use relative path. This automatically uses https://dam.capy-dev.com in prod
          const res = await fetch('/api/upload', { 
              method: 'POST', 
              body: formData 
          });
          
          if (!res.ok) throw new Error('Upload failed');
          return await res.json(); 
      } catch (error) {
          console.error("Upload error:", error);
          toast.error("Failed to upload file");
          return null;
      }
  };

  const sendMessage = async (content: string, file?: File) => {
    if (!socket || !user || !activeRoom) return;
    
    setIsSending(true); // ✅ Start Loader
    if (sendingTimeoutRef.current) clearTimeout(sendingTimeoutRef.current);
    sendingTimeoutRef.current = setTimeout(() => setIsSending(false), 5000); // Safety timeout

    socket.emit('stop_typing', activeRoom);
    let attachmentData = {};
    if (file) {
        const uploadResult = await uploadFile(file);
        if (uploadResult) attachmentData = { attachmentUrl: uploadResult.url, attachmentType: uploadResult.mimetype, attachmentName: uploadResult.filename };
        else { setIsSending(false); return; }
    }
    socket.emit('send_message', { content, userId: user.id, roomId: activeRoom, ...attachmentData });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    // ❌ REMOVED setIsSending(false) - waiting for receive_message
  };

  const sendThreadMessage = async (content: string, parentId: string, file?: File) => {
      if (!socket || !user || !activeRoom) return;
      let attachmentData = {};
      if (file) {
          const uploadResult = await uploadFile(file);
          if (uploadResult) attachmentData = { attachmentUrl: uploadResult.url, attachmentType: uploadResult.mimetype, attachmentName: uploadResult.filename };
          else return; 
      }
      socket.emit('send_thread_message', { content, userId: user.id, roomId: activeRoom, parentId, ...attachmentData });
  };

  const sendTyping = () => {
      if(!socket || !user || !activeRoom) return;
      socket.emit('typing', { roomId: activeRoom, name: user.name });
      if(typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => socket.emit('stop_typing', activeRoom), 2000);
  };

  const deleteMessage = (id: string) => socket?.emit('delete_message', id);
  const editMessage = (id: string, newContent: string) => socket?.emit('edit_message', { messageId: id, newContent });
  const addReaction = (messageId: string, emoji: string) => { if (socket && activeRoom) socket.emit('add_reaction', { messageId, emoji, roomId: activeRoom }); };
  const removeReaction = (messageId: string, emoji: string) => { if (socket && activeRoom) socket.emit('remove_reaction', { messageId, emoji, roomId: activeRoom }); };
  const openThread = (message: Message) => { if (activeThread?.id === message.id) return; setIsThreadOpen(true); setActiveThread({ id: message.id, replies: [] }); socket?.emit('join_thread', message.id); };
  const closeThread = () => { if (activeThread) socket?.emit('leave_thread', activeThread.id); setIsThreadOpen(false); setActiveThread(null); };

  return {
    user, activeRoom, activeDM, channels, activeDMs, messages, 
    onlineUsers, allUsers, isLoadingChannels, isLoadingMessages, isSending, typingUsers,
    isFetchingHistory, hasMore, loadMoreMessages,
    joinRoom, switchToDM, startDM, createChannel, createGroup, deleteChannel,
    addMember, kickMember, sendMessage, sendTyping, deleteMessage, editMessage,
    addReaction, removeReaction, activeThread, isThreadOpen, openThread, closeThread, sendThreadMessage
  };
};