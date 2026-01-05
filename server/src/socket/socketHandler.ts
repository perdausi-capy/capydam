import { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma'; 

interface ChatMessage { 
  content: string; 
  userId: string; 
  roomId: string;
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentName?: string;
}

let isSocketInitialized = false;
const onlineUsers = new Map<string, { userId: string; name: string; avatar?: string }>();

// Helper for consistent message includes
const messageInclude = {
    user: { select: { id: true, name: true, avatar: true } },
    reactions: { 
        include: { 
            user: { select: { id: true, name: true } } 
        } 
    }
};

// ✅ HELPER: Transform "Memberships" back to "Members" list for Frontend
const transformRoomData = (room: any) => {
    return {
        ...room,
        members: room.memberships?.map((m: any) => m.user) || [], // Flatten the structure
        memberships: undefined // Remove the raw join table data
    };
};

export const setupSocketIO = (io: Server) => {
  if (isSocketInitialized) return;
  isSocketInitialized = true;
  console.log("✅ [Socket] Initializing Socket.io listeners...");

  io.on('connection', (socket: Socket) => {
    
    // --- 1. INITIALIZATION ---
    socket.on('register_user', async (user) => {
        socket.data.userId = user.userId;
        socket.data.name = user.name;
        
        onlineUsers.set(socket.id, user);
        io.emit('update_online_users', Array.from(onlineUsers.values()));
        
        try {
            // ✅ UPDATED: Query memberships instead of members
            const rawChannels = await prisma.chatRoom.findMany({
                where: {
                    OR: [
                        { type: 'channel' },
                        { memberships: { some: { userId: user.userId } } }
                    ]
                },
                orderBy: { createdAt: 'asc' },
                include: { 
                    memberships: { 
                        include: { user: { select: { id: true, name: true, avatar: true } } } 
                    } 
                } 
            });

            // ✅ Transform data before sending
            const channels = rawChannels.map(transformRoomData);
            socket.emit('update_channel_list', channels);
        } catch (e) { console.error("Error fetching channels:", e); }
    });

    socket.on('fetch_all_users', async () => {
        try {
            const users = await prisma.user.findMany({
                select: { id: true, name: true, avatar: true },
                take: 100
            });
            socket.emit('receive_all_users', users);
        } catch (e) { console.error(e); }
    });

    // --- 2. CHANNEL/GROUP MANAGEMENT ---
    socket.on('create_channel', async (channelName) => {
        try {
            const existing = await prisma.chatRoom.findFirst({ where: { name: channelName } });
            if (existing) return;
            await prisma.chatRoom.create({ data: { name: channelName, type: 'channel' } });
            
            // Fetch updated list
            const rawChannels = await prisma.chatRoom.findMany({ 
                where: { type: 'channel' }, 
                orderBy: { createdAt: 'asc' },
                include: { memberships: { include: { user: true } } }
            });
            
            io.emit('update_channel_list', rawChannels.map(transformRoomData));
        } catch (e) { console.error(e); }
    });

    socket.on('create_group', async (data: { name: string }) => {
        const sender = onlineUsers.get(socket.id);
        if (!sender) return;
        try {
            // ✅ UPDATED: Create Membership entry
            await prisma.chatRoom.create({
                data: {
                    name: data.name,
                    type: 'group',
                    memberships: { 
                        create: { userId: sender.userId, role: 'ADMIN' } 
                    }
                }
            });

            const rawChannels = await prisma.chatRoom.findMany({
                where: { OR: [{ type: 'channel' }, { memberships: { some: { userId: sender.userId } } }] },
                orderBy: { createdAt: 'asc' },
                include: { memberships: { include: { user: true } } }
            });
            
            socket.emit('update_channel_list', rawChannels.map(transformRoomData));
        } catch (e) { console.error("Create Group Error:", e); }
    });

    socket.on('add_member_to_group', async (data: { roomId: string, userId: string }) => {
        try {
            // ✅ UPDATED: Create Membership explicitly
            // Use upsert to avoid crashing if they are already added
            await prisma.membership.upsert({
                where: {
                    userId_roomId: { userId: data.userId, roomId: data.roomId }
                },
                update: {}, // Do nothing if exists
                create: { userId: data.userId, roomId: data.roomId }
            });

            const allSockets = await io.fetchSockets();
            for (const sock of allSockets) {
                const sUser = onlineUsers.get(sock.id);
                if (sUser && (sUser.userId === data.userId || true)) { 
                    const rawChannels = await prisma.chatRoom.findMany({
                        where: { OR: [{ type: 'channel' }, { memberships: { some: { userId: sUser.userId } } }] },
                        orderBy: { createdAt: 'asc' },
                        include: { memberships: { include: { user: true } } }
                    });
                    io.to(sock.id).emit('update_channel_list', rawChannels.map(transformRoomData));
                }
            }
        } catch (e) { console.error(e); }
    });

    socket.on('kick_member', async (data: { roomId: string, userId: string }) => {
        try {
            const room = await prisma.chatRoom.findUnique({ where: { id: data.roomId } });
            if (!room) return;

            // ✅ UPDATED: Delete Membership
            await prisma.membership.deleteMany({
                where: { 
                    roomId: data.roomId,
                    userId: data.userId 
                }
            });

            const allSockets = await io.fetchSockets();
            for (const sock of allSockets) {
                const sUser = onlineUsers.get(sock.id);
                if (sUser && sUser.userId === data.userId) {
                    const socketInstance = io.sockets.sockets.get(sock.id);
                    if (socketInstance) {
                        socketInstance.leave(room.name);
                        socketInstance.emit('kicked_from_room', { roomId: room.id, name: room.name });
                    }
                    const rawChannels = await prisma.chatRoom.findMany({
                        where: { OR: [{ type: 'channel' }, { memberships: { some: { userId: sUser.userId } } }] },
                        orderBy: { createdAt: 'asc' },
                        include: { memberships: { include: { user: true } } }
                    });
                    io.to(sock.id).emit('update_channel_list', rawChannels.map(transformRoomData));
                }
            }
        } catch (e) { console.error("Kick Member Error:", e); }
    });

    socket.on('delete_channel', async (channelId) => {
        try {
            await prisma.message.deleteMany({ where: { roomId: channelId } });
            // Deleting room will cascade delete Memberships automatically
            await prisma.chatRoom.delete({ where: { id: channelId } });
            
            const allSockets = await io.fetchSockets();
            for (const sock of allSockets) {
                const sUser = onlineUsers.get(sock.id);
                if (sUser) {
                    const rawChannels = await prisma.chatRoom.findMany({
                        where: { OR: [{ type: 'channel' }, { memberships: { some: { userId: sUser.userId } } }] },
                        orderBy: { createdAt: 'asc' },
                        include: { memberships: { include: { user: true } } }
                    });
                    io.to(sock.id).emit('update_channel_list', rawChannels.map(transformRoomData));
                }
            }
        } catch (e) { console.error(e); }
    });

        // --- 3. JOIN & HISTORY ---
        socket.on('join_room', async (roomId) => {
            socket.join(roomId);
            try {
                // 1. Find the room (by ID or Name)
                const room = await prisma.chatRoom.findFirst({ 
                    where: { OR: [{ id: roomId }, { name: roomId }] } 
                });

                if (room) {
                    const userId = socket.data.userId || onlineUsers.get(socket.id)?.userId;
                    
                    // ✅ FIX: Ensure Membership exists so we can track 'lastReadAt'
                    if (userId) {
                        await prisma.membership.upsert({
                            where: {
                                userId_roomId: { userId: userId, roomId: room.id }
                            },
                            update: { lastReadAt: new Date() }, // Update if exists
                            create: { 
                                userId: userId, 
                                roomId: room.id, 
                                lastReadAt: new Date(),
                                role: 'MEMBER'
                            } // Create if missing
                        });
                    }

                    // 2. Fetch History
                    const history = await prisma.message.findMany({
                        where: { 
                            roomId: room.id, 
                            parentId: null 
                        },
                        take: 50,
                        orderBy: { createdAt: 'desc' },
                        include: {
                            ...messageInclude,
                            _count: { select: { replies: true } }
                        }
                    });
                    socket.emit('load_history', history.reverse());
                }
            } catch (e) {
                console.error("Join Room Error:", e);
            }
        });

    socket.on('fetch_history', async ({ roomId, cursor }: { roomId: string, cursor: string }) => {
        try {
            const room = await prisma.chatRoom.findFirst({ where: { OR: [{ id: roomId }, { name: roomId }] } });
            if (!room) return;

            const olderMessages = await prisma.message.findMany({
                where: { 
                    roomId: room.id,
                    parentId: null 
                },
                take: 50,
                skip: 1, 
                cursor: { id: cursor },
                orderBy: { createdAt: 'desc' }, 
                include: {
                    ...messageInclude,
                    _count: { select: { replies: true } } 
                }
            });

            socket.emit('history_chunk', olderMessages.reverse());
        } catch (e) {
            console.error("History Fetch Error:", e);
        }
    });

    socket.on('send_message', async (data: ChatMessage) => {
      try {
        let room = await prisma.chatRoom.findFirst({ where: { OR: [{ id: data.roomId }, { name: data.roomId }] } });
        if (!room) return; 
        
        const savedMessage = await prisma.message.create({
          data: { 
              content: data.content, 
              userId: data.userId, 
              roomId: room.id,
              attachmentUrl: data.attachmentUrl,
              attachmentType: data.attachmentType,
              attachmentName: data.attachmentName
          },
          include: {
              ...messageInclude,
              _count: { select: { replies: true } } 
          }
        });

        io.to(data.roomId).emit('receive_message', savedMessage);
        
        if (room.name && room.name !== data.roomId) io.to(room.name).emit('receive_message', savedMessage);
        if (room.id && room.id !== data.roomId) io.to(room.id).emit('receive_message', savedMessage);
      } catch (error) {
          console.error("Socket Message Error:", error);
      }
    });

    // --- 4. START DIRECT MESSAGE ---
    socket.on('start_dm', async (targetUserId) => {
        const sender = onlineUsers.get(socket.id);
        if (!sender) return;

        let targetUserObj = Array.from(onlineUsers.values()).find(u => u.userId === targetUserId);
        if (!targetUserObj) {
            try {
                const dbUser = await prisma.user.findUnique({ where: { id: targetUserId } });
                if (dbUser) {
                    targetUserObj = { userId: dbUser.id, name: dbUser.name || 'User', avatar: dbUser.avatar || undefined };
                }
            } catch (e) { console.error("Error fetching DM target:", e); }
        }
        
        if (!targetUserObj) return; 

        const participants = [sender.userId, targetUserId].sort();
        const dmRoomName = `dm_${participants[0]}_${participants[1]}`;

        try {
            let room = await prisma.chatRoom.findFirst({ where: { name: dmRoomName } });
            
            if (!room) {
                room = await prisma.chatRoom.create({
                    data: {
                        name: dmRoomName,
                        type: 'dm',
                        memberships: {
                            create: [
                                { userId: sender.userId },
                                { userId: targetUserId }
                            ]
                        }
                    }
                });
            } else {
                // Ensure both are members
                const existingMembers = await prisma.membership.findMany({ where: { roomId: room.id } });
                const missing = [sender.userId, targetUserId].filter(uid => !existingMembers.some(m => m.userId === uid));
                
                if (missing.length > 0) {
                    await prisma.membership.createMany({
                        data: missing.map(uid => ({ userId: uid, roomId: room!.id }))
                    });
                }
            }

            socket.join(room.name);
            socket.emit('dm_started', { roomId: room.name, otherUser: targetUserObj });

            const targetSocketEntry = Array.from(onlineUsers.entries()).find(([_, u]) => u.userId === targetUserId);
            if (targetSocketEntry) {
                const [targetSocketId] = targetSocketEntry;
                const targetSocket = io.sockets.sockets.get(targetSocketId);
                if (targetSocket) {
                    targetSocket.join(room.name);
                    io.to(targetSocketId).emit('dm_started', { roomId: room.name, otherUser: sender });
                }
            }
        } catch (e) { console.error("Start DM Error:", e); }
    });

    socket.on('disconnect', () => {
        onlineUsers.delete(socket.id);
        io.emit('update_online_users', Array.from(onlineUsers.values()));
    });
    
    // Typing & Mod
    socket.on('delete_message', async (id) => { try { await prisma.message.delete({ where: { id } }); io.emit('message_deleted', id); } catch(e){} });
    socket.on('edit_message', async (data) => { 
        try { 
            const m = await prisma.message.update({ 
                where: { id: data.messageId }, 
                data: { content: data.newContent }, 
                include: {
                    ...messageInclude,
                    _count: { select: { replies: true } }
                }
            }); 
            io.emit('message_updated', m); 
        } catch(e){} 
    });
    
    // REACTIONS
    socket.on('add_reaction', async ({ messageId, emoji, roomId }) => {
        try {
            const userId = socket.data.userId || onlineUsers.get(socket.id)?.userId;
            if (!userId) return;

            await prisma.reaction.create({
                data: { emoji, messageId, userId: userId }
            });

            const updatedMessage = await prisma.message.findUnique({
                where: { id: messageId },
                include: {
                    ...messageInclude, 
                    _count: { select: { replies: true } }
                }
            });

            if (updatedMessage) {
                io.to(roomId).emit('message_updated', updatedMessage);
                if (updatedMessage.parentId) {
                    io.to(`thread_${updatedMessage.parentId}`).emit('message_updated', updatedMessage);
                }
            }
        } catch (e) { console.error("Add Reaction Error:", e); }
    });

    socket.on('remove_reaction', async ({ messageId, emoji, roomId }) => {
        try {
            const userId = socket.data.userId || onlineUsers.get(socket.id)?.userId;
            if (!userId) return;

            const reaction = await prisma.reaction.findFirst({
                where: { messageId, emoji, userId: userId }
            });

            if (reaction) {
                await prisma.reaction.delete({ where: { id: reaction.id } });

                const updatedMessage = await prisma.message.findUnique({
                    where: { id: messageId },
                    include: {
                        ...messageInclude,
                        _count: { select: { replies: true } }
                    }
                });

                if (updatedMessage) {
                    io.to(roomId).emit('message_updated', updatedMessage);
                    if (updatedMessage.parentId) {
                        io.to(`thread_${updatedMessage.parentId}`).emit('message_updated', updatedMessage);
                    }
                }
            }
        } catch (e) { console.error("Remove Reaction Error:", e); }
    });

    // Thread Logic
    socket.on('join_thread', async (parentMessageId) => {
        socket.join(`thread_${parentMessageId}`);
        try {
            const replies = await prisma.message.findMany({
                where: { parentId: parentMessageId },
                orderBy: { createdAt: 'asc' },
                include: messageInclude
            });
            socket.emit('load_thread_messages', replies);
        } catch (e) { console.error(e); }
    });

    socket.on('leave_thread', (parentMessageId) => {
        socket.leave(`thread_${parentMessageId}`);
    });

    socket.on('send_thread_message', async (data: ChatMessage & { parentId: string }) => {
        try {
            const room = await prisma.chatRoom.findFirst({
                where: { OR: [ { id: data.roomId }, { name: data.roomId } ] }
            });

            if (!room) {
                console.error(`Error: Room not found for ID/Name: ${data.roomId}`);
                return;
            }

            const savedMessage = await prisma.message.create({
                data: {
                    content: data.content,
                    userId: data.userId,
                    roomId: room.id,
                    parentId: data.parentId, 
                    attachmentUrl: data.attachmentUrl,
                    attachmentType: data.attachmentType,
                    attachmentName: data.attachmentName
                },
                include: messageInclude
            });

            io.to(`thread_${data.parentId}`).emit('receive_thread_message', savedMessage);

            const replyCount = await prisma.message.count({ where: { parentId: data.parentId } });
            
            io.to(room.id).emit('thread_updated', { parentId: data.parentId, count: replyCount });
            if (room.name) io.to(room.name).emit('thread_updated', { parentId: data.parentId, count: replyCount });

        } catch (error) { 
            console.error("Thread Message Error:", error); 
        }
    });

    socket.on('typing', (data) => socket.to(data.roomId).emit('user_typing', data));
    socket.on('stop_typing', (roomId) => socket.to(roomId).emit('user_stop_typing'));
  });
};