import { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma'; 

// --- TYPES ---
interface SocketUser {
    userId: string;
    name: string;
    avatar?: string;
}

// Global Online Users Map
const onlineUsers = new Map<string, SocketUser>(); // Key: SocketID, Value: UserData

export const setupSocketIO = (io: Server) => {
    console.log("✅ [Socket] System Initialized (v4 - Complete)");

    io.on('connection', (socket: Socket) => {
        
        // --- 1. REGISTRATION & AUTO-JOIN ---
        socket.on('register_user', async (user: SocketUser) => {
            console.log(`🔌 Connected: ${user.name} (${user.userId})`);
            
            // 1. Attach Data
            socket.data.userId = user.userId;
            socket.data.name = user.name;
            onlineUsers.set(socket.id, user);

            // 2. Join Personal Room (for private notifs)
            socket.join(user.userId);

            // 3. Auto-Join ALL existing Rooms (Channels, Groups, DMs)
            try {
                // Find all rooms where this user has a membership (DMs, Private Groups)
                const myRooms = await prisma.chatRoom.findMany({
                    where: {
                        memberships: { some: { userId: user.userId } }
                    },
                    select: { id: true }
                });

                // Find ALL public channels (Type: 'global')
                // We force-join everyone to global channels so they get updates instantly
                const publicRooms = await prisma.chatRoom.findMany({
                    where: { type: 'global' },
                    select: { id: true }
                });

                // Combine IDs (Deduplicated)
                const allRoomIds = new Set([...myRooms.map(r => r.id), ...publicRooms.map(r => r.id)]);

                // Force Socket Join
                allRoomIds.forEach(roomId => {
                    socket.join(roomId);
                });
                
                console.log(`📂 Auto-joined ${allRoomIds.size} rooms for ${user.name}`);

                // 4. Send Initial Data to Client
                io.emit('update_online_users', Array.from(onlineUsers.values()));
                
                // Send list of rooms to frontend so it can render the sidebar
                const fullRooms = await prisma.chatRoom.findMany({
                    where: { id: { in: Array.from(allRoomIds) } },
                    include: {
                        memberships: {
                            include: { user: { select: { id: true, name: true, avatar: true } } }
                        },
                        // Get last message for snippets/sorting
                        messages: {
                            take: 1,
                            orderBy: { createdAt: 'desc' },
                            select: { content: true, createdAt: true }
                        }
                    },
                    orderBy: { createdAt: 'asc' } // Keep channels stable
                });
                
                socket.emit('sync_room_list', fullRooms);

            } catch (e) {
                console.error("❌ Auto-Join Error:", e);
            }
        });

        // --- 2. CREATE PUBLIC CHANNEL ---
        socket.on('create_channel', async (name: string) => {
            // Sanitize: "General Chat" -> "general-chat"
            const safeName = name.trim().toLowerCase().replace(/\s+/g, '-');
            if (!safeName) return;

            console.log(`📢 Creating Channel: #${safeName}`);

            try {
                // 1. Check if exists
                const existing = await prisma.chatRoom.findFirst({
                    where: { name: safeName, type: 'global' }
                });

                if (existing) return; 

                // 2. Create in DB
                const newRoom = await prisma.chatRoom.create({
                    data: {
                        name: safeName,
                        type: 'global' // Marks it as public
                    },
                    include: {
                        memberships: { include: { user: true } },
                        messages: { take: 1 }
                    }
                });

                // 3. Make EVERYONE join this new room immediately
                const allSockets = await io.fetchSockets();
                for (const s of allSockets) {
                    s.join(newRoom.id);
                }

                // 4. Broadcast to frontend to update sidebar
                io.emit('room_created', newRoom);

            } catch (e) {
                console.error("❌ Create Channel Error:", e);
            }
        });

        // --- 2.6 DELETE ROOM (Channels or Groups) ---
        socket.on('delete_room', async (roomId: string) => {
            const userId = socket.data.userId;
            if (!userId || !roomId) return;

            try {
                // 1. Check permissions (Must be ADMIN)
                // Note: For public channels, you might want to restrict this to system admins
                // For now, we allow the creator (who gets ADMIN role) to delete.
                
                // First, check if user is a member/admin
                const membership = await prisma.membership.findUnique({
                    where: { userId_roomId: { userId, roomId } }
                });

                // Allow if ADMIN (for groups) or maybe implement specific logic for global channels
                // For simplicity: specific global channel checks can be added here
                if (membership?.role !== 'ADMIN') {
                     // If it's a global channel, maybe check if user is a system admin?
                     // For this demo, we will assume only room ADMINs can delete.
                     return;
                }

                // 2. Delete the Room
                await prisma.chatRoom.delete({
                    where: { id: roomId }
                });

                // 3. Broadcast Deletion (Remove from everyone's sidebar)
                io.emit('room_deleted', roomId);

            } catch (e) {
                console.error("❌ Delete Room Error:", e);
            }
        });

        // --- 3. CREATE PRIVATE GROUP ---
        socket.on('create_group', async (data: { name: string }) => {
            const senderId = socket.data.userId;
            if (!senderId || !data.name) return;

            try {
                const newGroup = await prisma.chatRoom.create({
                    data: {
                        name: data.name,
                        type: 'group',
                        memberships: {
                            create: { userId: senderId, role: 'ADMIN' }
                        }
                    },
                    include: {
                        memberships: { include: { user: true } },
                        messages: { take: 1 }
                    }
                });

                socket.join(newGroup.id);
                socket.emit('room_created', newGroup); // Only sender sees it initially
            } catch (e) {
                console.error("❌ Create Group Error:", e);
            }
        });

        // --- 3.5 ADD MEMBER TO GROUP ---
        socket.on('add_member', async (data: { roomId: string, targetUserId: string }) => {
            const senderId = socket.data.userId;
            if (!senderId || !data.roomId || !data.targetUserId) return;

            try {
                // 1. Verify Sender Permission
                const senderMembership = await prisma.membership.findUnique({
                    where: { userId_roomId: { userId: senderId, roomId: data.roomId } }
                });
                if (!senderMembership) return;

                // 2. Check if Target is ALREADY in the group
                const existing = await prisma.membership.findUnique({
                    where: { userId_roomId: { userId: data.targetUserId, roomId: data.roomId } }
                });
                if (existing) return;

                // 3. Get Target User Details
                const targetUser = await prisma.user.findUnique({ 
                    where: { id: data.targetUserId },
                    select: { name: true }
                });
                const targetName = targetUser?.name || 'Unknown User';

                // 4. Create Membership
                await prisma.membership.create({
                    data: { userId: data.targetUserId, roomId: data.roomId, role: 'MEMBER' }
                });

                // 5. Force Target Socket to Join
                const targetSocketEntry = Array.from(onlineUsers.entries()).find(([, u]) => u.userId === data.targetUserId);
                if (targetSocketEntry) {
                    const [targetSocketId] = targetSocketEntry;
                    const targetSocket = io.sockets.sockets.get(targetSocketId);
                    if (targetSocket) {
                        targetSocket.join(data.roomId);
                        // Fetch room data to push to their sidebar
                        const roomData = await prisma.chatRoom.findUnique({
                            where: { id: data.roomId },
                            include: {
                                memberships: { include: { user: true } },
                                messages: { take: 1, orderBy: { createdAt: 'desc' } }
                            }
                        });
                        if (roomData) targetSocket.emit('room_created', roomData);
                    }
                }

                // 6. Create System Message
                const sysMsg = await prisma.message.create({
                    data: {
                        content: `${socket.data.name} added ${targetName} to the group.`,
                        userId: senderId, 
                        roomId: data.roomId,
                        attachmentType: 'system'
                    },
                    include: { user: { select: { id: true, name: true, avatar: true } } }
                });

                // 7. Broadcast update
                io.to(data.roomId).emit('receive_message', sysMsg);

            } catch (e) {
                console.error("❌ Add Member Error:", e);
            }
        });


        // --- 3.6 KICK MEMBER ---
        socket.on('kick_member', async (data: { roomId: string, targetUserId: string }) => {
            const senderId = socket.data.userId;
            if (!senderId || !data.roomId || !data.targetUserId) return;

            try {
                // 1. Verify Requester is ADMIN
                const requesterMembership = await prisma.membership.findUnique({
                    where: { userId_roomId: { userId: senderId, roomId: data.roomId } }
                });

                if (requesterMembership?.role !== 'ADMIN') return; 

                // 2. Get Target Name
                const targetUser = await prisma.user.findUnique({ where: { id: data.targetUserId } });
                const targetName = targetUser?.name || 'User';

                // 3. Delete Membership
                await prisma.membership.delete({
                    where: { userId_roomId: { userId: data.targetUserId, roomId: data.roomId } }
                });

                // 4. Handle Target Socket (If Online)
                const targetSocketEntry = Array.from(onlineUsers.entries()).find(([, u]) => u.userId === data.targetUserId);
                if (targetSocketEntry) {
                    const [targetSocketId] = targetSocketEntry;
                    const targetSocket = io.sockets.sockets.get(targetSocketId);
                    if (targetSocket) {
                        targetSocket.leave(data.roomId);
                        targetSocket.emit('kicked_from_room', data.roomId);
                    }
                }

                // 5. System Message
                const sysMsg = await prisma.message.create({
                    data: {
                        content: `${socket.data.name} removed ${targetName} from the group.`,
                        userId: senderId,
                        roomId: data.roomId,
                        attachmentType: 'system'
                    },
                    include: { user: true }
                });
                io.to(data.roomId).emit('receive_message', sysMsg);

                // 6. Broadcast Member List Update
                const updatedRoom = await prisma.chatRoom.findUnique({
                    where: { id: data.roomId },
                    include: {
                        memberships: { include: { user: true } },
                        messages: { take: 1, orderBy: { createdAt: 'desc' } }
                    }
                });
                if (updatedRoom) {
                    io.to(data.roomId).emit('room_updated', updatedRoom);
                }

            } catch (e) {
                console.error("❌ Kick Member Error:", e);
            }
        });

        // --- 4. MESSAGING (STRICT UUID) ---
        socket.on('send_message', async (data: { content: string, roomId: string, attachmentUrl?: string, attachmentType?: string, attachmentName?: string }) => {
            const senderId = socket.data.userId;
            if (!senderId) return;

            try {
                // 1. Create Message
                const message = await prisma.message.create({
                    data: {
                        content: data.content,
                        userId: senderId,
                        roomId: data.roomId,
                        attachmentUrl: data.attachmentUrl,
                        attachmentType: data.attachmentType,
                        attachmentName: data.attachmentName
                    },
                    include: {
                        user: { select: { id: true, name: true, avatar: true } },
                        reactions: true
                    }
                });

                // 2. Broadcast to Room UUID
                io.to(data.roomId).emit('receive_message', message);

                // 3. Mentions
                const mentionRegex = /@(\w+)/g; 
                const matches = data.content.match(mentionRegex);
                if (matches) {
                    for (const match of matches) {
                        const name = match.substring(1);
                        const target = await prisma.user.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
                        if (target) {
                            io.to(target.id).emit('receive_notification', {
                                id: crypto.randomUUID(), 
                                text: `Mentioned you in a message`,
                                senderName: socket.data.name,
                                roomId: data.roomId,
                                roomName: 'chat',
                                createdAt: new Date().toISOString(),
                                read: false
                            });
                        }
                    }
                }

            } catch (e) {
                console.error("❌ Send Error:", e);
            }
        });

        // --- 4.5 EDIT MESSAGE (NEW) ---
        socket.on('edit_message', async (data: { messageId: string, newContent: string, roomId: string }) => {
            const senderId = socket.data.userId;
            if (!senderId || !data.messageId || !data.newContent) return;

            try {
                const existing = await prisma.message.findUnique({ where: { id: data.messageId } });
                if (!existing || existing.userId !== senderId) return;

                const updatedMessage = await prisma.message.update({
                    where: { id: data.messageId },
                    data: { 
                        content: data.newContent,
                        // Note: Ensure your Prisma schema has an updatedAt field or handled automatically
                    },
                    include: {
                        user: { select: { id: true, name: true, avatar: true } },
                        reactions: true
                    }
                });

                // Manually inject 'updatedAt' flag if schema doesn't auto-handle it effectively for the UI check
                // or just rely on the 'updatedAt' timestamp from DB
                
                io.to(data.roomId).emit('message_updated', updatedMessage);

            } catch (e) {
                console.error("❌ Edit Message Error:", e);
            }
        });

        // --- 4.6 DELETE MESSAGE (NEW) ---
        socket.on('delete_message', async (data: { messageId: string, roomId: string }) => {
            const senderId = socket.data.userId;
            if (!senderId || !data.messageId) return;

            try {
                const existing = await prisma.message.findUnique({ where: { id: data.messageId } });
                if (!existing || existing.userId !== senderId) return;

                await prisma.message.delete({ where: { id: data.messageId } });

                io.to(data.roomId).emit('message_deleted', data.messageId);

            } catch (e) {
                console.error("❌ Delete Message Error:", e);
            }
        });

        // --- 5. START DM (ATOMIC FIND-OR-CREATE) ---
        socket.on('start_dm', async (targetUserId: string) => {
            const myId = socket.data.userId;
            if (!myId || !targetUserId) return;

            try {
                // 1. Check if DM Room already exists
                let room = await prisma.chatRoom.findFirst({
                    where: {
                        type: 'dm',
                        AND: [
                            { memberships: { some: { userId: myId } } },
                            { memberships: { some: { userId: targetUserId } } }
                        ]
                    },
                    include: {
                        memberships: { include: { user: true } },
                        messages: { take: 1, orderBy: { createdAt: 'desc' } }
                    }
                });

                // 2. If not, Create it
                if (!room) {
                    room = await prisma.chatRoom.create({
                        data: {
                            name: 'dm',
                            type: 'dm',
                            memberships: {
                                create: [
                                    { userId: myId, role: 'MEMBER' },
                                    { userId: targetUserId, role: 'MEMBER' }
                                ]
                            }
                        },
                        include: {
                            memberships: { include: { user: true } },
                            messages: { take: 1 }
                        }
                    });
                }

                // 3. Ensure both sockets join this room immediately
                socket.join(room.id); // Join sender
                
                // Find target socket if online
                const targetSocketEntry = Array.from(onlineUsers.entries()).find(([, u]) => u.userId === targetUserId);
                if (targetSocketEntry) {
                    const [targetSocketId] = targetSocketEntry;
                    const targetSocket = io.sockets.sockets.get(targetSocketId);
                    if (targetSocket) {
                        targetSocket.join(room.id);
                        // ✅ FIX: Notify the target user so it appears in their sidebar immediately
                        targetSocket.emit('room_created', room);
                    }
                }

                // 4. Tell Sender "Here is your room" (and switch to it)
                socket.emit('open_dm', room);

            } catch (e) {
                console.error("❌ Start DM Error:", e);
            }
        });

        // --- 6. HISTORY ---
        socket.on('fetch_history', async (roomId: string) => {
            try {
                const history = await prisma.message.findMany({
                    where: { roomId },
                    take: 50,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        user: { select: { id: true, name: true, avatar: true } },
                        reactions: { include: { user: { select: { id: true, name: true } } } },
                        _count: { select: { replies: true } }
                    }
                });
                socket.emit('history_loaded', { roomId, messages: history.reverse() });
            } catch (e) { console.error(e); }
        });

        // --- 7. CLEANUP ---
        socket.on('disconnect', () => {
            onlineUsers.delete(socket.id);
            io.emit('update_online_users', Array.from(onlineUsers.values()));
        });
    });
};