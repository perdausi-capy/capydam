import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

// --- TYPES ---
export interface Message {
  id: string; 
  content: string; 
  userId: string; 
  roomId: string;
  user: { id: string; name: string; avatar?: string; };
  createdAt: string; 
  updatedAt?: string;
  attachmentUrl?: string;
  attachmentType?: string; 
  attachmentName?: string;
  reactions?: any[];
}

export interface Room {
  id: string; 
  name: string; 
  type: string; // 'global', 'dm', 'group'
  unreadCount?: number;
  memberships: { 
      role: string; 
      user: { id: string; name: string; avatar?: string } 
  }[];
  lastMessage?: { content: string; createdAt: string };
}

export interface OnlineUser { userId: string; name: string; avatar?: string; }

export const useChat = () => {
  const { socket } = useSocket();
  const { user } = useAuth();

  // --- STATE ---
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [allUsers, setAllUsers] = useState<{id:string, name:string, avatar?:string}[]>([]);
  
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // --- ACTIONS ---
  
  // 1. Select a Room
  const selectRoom = useCallback((roomId: string) => {
      setActiveRoomId(roomId);
      setMessages([]); // Clear view instantly
      setIsLoadingMessages(true);
      
      // Reset unread count locally
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, unreadCount: 0 } : r));
      
      if (socket) {
          socket.emit('fetch_history', roomId);
      }
  }, [socket]);

  // 2. Start DM
  const startDM = useCallback((targetUserId: string) => {
      if (!socket) return;
      // Optimistic check
      const existing = rooms.find(r => r.type === 'dm' && r.memberships.some(m => m.user.id === targetUserId));
      
      if (existing) {
          selectRoom(existing.id);
      } else {
          socket.emit('start_dm', targetUserId);
      }
  }, [socket, rooms, selectRoom]);

  // 3. Create Public Channel
  const createChannel = useCallback((name: string) => {
      if (socket && name.trim()) {
          socket.emit('create_channel', name);
      }
  }, [socket]);

  // 4. Create Private Group
  const createGroup = useCallback((name: string) => {
      if (socket && name.trim()) {
          socket.emit('create_group', { name });
      }
  }, [socket]);

  // ✅ 5. File Upload Helper (Production Ready)
  // 5. File Upload Helper (Robust Production Fix)
  // 5. File Upload Helper (Final URL Fix)
  const uploadFile = async (file: File): Promise<string | null> => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        // 1. Get API URL (e.g., https://dam.capy-dev.com/api)
        let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        
        // Remove trailing slash if it exists
        if (API_URL.endsWith('/')) API_URL = API_URL.slice(0, -1);

        // 2. Determine Endpoint for Uploading
        // If API_URL has "/api", we append "/upload". If not, "/api/upload".
        const uploadEndpoint = API_URL.endsWith('/api') 
            ? `${API_URL}/upload` 
            : `${API_URL}/api/upload`;

        const res = await fetch(uploadEndpoint, { 
            method: 'POST', 
            body: formData 
        });

        if (!res.ok) throw new Error("Upload failed");
        
        const data = await res.json();
        
        // 3. Construct Display URL (CRITICAL FIX)
        // The server returns "/uploads/filename.jpg". 
        // We need the ROOT domain (https://dam.capy-dev.com), NOT the API path.
        
        // Strip "/api" from the base URL if it exists
        const rootDomain = API_URL.replace(/\/api$/, ''); 
        
        return `${rootDomain}${data.url}`; 
        
    } catch (e) {
        console.error("Upload error:", e);
        toast.error("Failed to upload file");
        return null;
    }
};

  // 6. Send Message
  const sendMessage = useCallback(async (content: string, file?: File) => {
      if (!socket || !activeRoomId || !user) return;
      setIsSending(true);
      
      let attachmentData = {};

      if (file) {
          const url = await uploadFile(file);
          if (url) {
              attachmentData = {
                  attachmentUrl: url,
                  attachmentType: file.type,
                  attachmentName: file.name
              };
          } else {
              setIsSending(false);
              return;
          }
      }
      
      const payload = { content, roomId: activeRoomId, ...attachmentData };
      socket.emit('send_message', payload);
      setTimeout(() => setIsSending(false), 500);
  }, [socket, activeRoomId, user]);

  // 7. Add Member
  const addMember = useCallback((targetUserId: string, roomId: string) => {
      if (socket) socket.emit('add_member', { roomId, targetUserId });
  }, [socket]);

  // 8. Kick Member
  const kickMember = useCallback((targetUserId: string, roomId: string) => {
      if (socket) socket.emit('kick_member', { roomId, targetUserId });
  }, [socket]);

  // 9. Edit Message
  const editMessage = useCallback((messageId: string, newContent: string) => {
      if (socket && activeRoomId) {
          socket.emit('edit_message', { messageId, newContent, roomId: activeRoomId });
      }
  }, [socket, activeRoomId]);

  // 10. Delete Message
  const deleteMessage = useCallback((messageId: string) => {
      if (socket && activeRoomId) {
          socket.emit('delete_message', { messageId, roomId: activeRoomId });
      }
  }, [socket, activeRoomId]);

  // 11. Delete Room
  const deleteRoom = useCallback((roomId: string) => {
      if (socket) socket.emit('delete_room', roomId);
  }, [socket]);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
      if (!socket || !user) return;

      socket.emit('register_user', { userId: user.id, name: user.name, avatar: user.avatar });
      socket.emit('fetch_all_users');

      // Room & List Management
      const handleSyncRooms = (serverRooms: Room[]) => setRooms(serverRooms.map(r => ({ ...r, unreadCount: 0 }))); 
      
      const handleRoomCreated = (newRoom: Room) => {
          setRooms(prev => {
              if (prev.some(r => r.id === newRoom.id)) return prev;
              return [...prev, { ...newRoom, unreadCount: 0 }];
          });
      };

      const handleRoomUpdated = (updatedRoom: Room) => {
          setRooms(prev => prev.map(r => r.id === updatedRoom.id ? { ...r, memberships: updatedRoom.memberships } : r));
      };

      const handleKicked = (kickedRoomId: string) => {
          setRooms(prev => prev.filter(r => r.id !== kickedRoomId));
          if (activeRoomId === kickedRoomId) {
              setActiveRoomId(null);
              setMessages([]);
              toast.error("You have been removed from the group.");
          }
      };

      const handleRoomDeleted = (deletedId: string) => {
          setRooms(prev => prev.filter(r => r.id !== deletedId));
          if (activeRoomId === deletedId) {
              setActiveRoomId(null);
              setMessages([]);
              toast.info("Room was deleted.");
          }
      };

      // Message Handling
      const handleReceiveMessage = (msg: Message) => {
          if (activeRoomId === msg.roomId) {
              setMessages(prev => {
                  if (prev.some(m => m.id === msg.id)) return prev;
                  return [...prev, msg];
              });
          } else {
              setRooms(prev => prev.map(r => {
                  if (r.id === msg.roomId) {
                      return { 
                          ...r, 
                          unreadCount: (r.unreadCount || 0) + 1,
                          lastMessage: { content: msg.content, createdAt: msg.createdAt } 
                      };
                  }
                  return r;
              }));
              if (msg.user.id !== user.id && msg.attachmentType !== 'system') {
                  toast.info(`New message from ${msg.user.name}`);
              }
          }
      };

      const handleMessageUpdated = (updatedMsg: Message) => {
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
      };

      const handleMessageDeleted = (deletedId: string) => {
          setMessages(prev => prev.filter(m => m.id !== deletedId));
      };

      // Navigation & Data
      const handleOpenDM = (room: Room) => {
          setRooms(prev => {
              if (prev.some(r => r.id === room.id)) return prev;
              return [room, ...prev];
          });
          selectRoom(room.id);
      };

      const handleHistory = (data: { roomId: string, messages: Message[] }) => {
          if (data.roomId === activeRoomId) {
              setMessages(data.messages);
              setIsLoadingMessages(false);
          }
      };

      // Register Events
      socket.on('sync_room_list', handleSyncRooms);
      socket.on('room_created', handleRoomCreated);
      socket.on('room_updated', handleRoomUpdated);
      socket.on('room_deleted', handleRoomDeleted);
      socket.on('kicked_from_room', handleKicked);
      socket.on('receive_message', handleReceiveMessage);
      socket.on('message_updated', handleMessageUpdated);
      socket.on('message_deleted', handleMessageDeleted);
      socket.on('open_dm', handleOpenDM);
      socket.on('history_loaded', handleHistory);
      socket.on('update_online_users', (users) => setOnlineUsers(users));
      socket.on('receive_all_users', (users) => setAllUsers(users));

      return () => {
          socket.off('sync_room_list');
          socket.off('room_created');
          socket.off('room_updated');
          socket.off('room_deleted');
          socket.off('kicked_from_room');
          socket.off('receive_message');
          socket.off('message_updated');
          socket.off('message_deleted');
          socket.off('open_dm');
          socket.off('history_loaded');
          socket.off('update_online_users');
          socket.off('receive_all_users');
      };
  }, [socket, user, activeRoomId, selectRoom]);

  // Helper: Get display name/avatar
  const getRoomDetails = useCallback((room: Room) => {
      if (room.type === 'dm') {
          const otherMember = room.memberships.find(m => m.user.id !== user?.id)?.user;
          return {
              name: otherMember?.name || 'Unknown User',
              avatar: otherMember?.avatar,
              isOnline: onlineUsers.some(u => u.userId === otherMember?.id)
          };
      }
      return { name: room.name, avatar: null, isOnline: false };
  }, [user, onlineUsers]);

  return {
      rooms, activeRoomId, messages, onlineUsers, allUsers,
      isLoadingMessages, isSending,
      selectRoom, startDM, createChannel, createGroup, 
      addMember, kickMember, deleteRoom,
      sendMessage, editMessage, deleteMessage, 
      getRoomDetails
  };
};