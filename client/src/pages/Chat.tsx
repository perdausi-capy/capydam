import { useMemo, useEffect, useRef, useState } from 'react';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../context/AuthContext';
import ChatInput from '../components/ChatInput'; 
import { Hash, Lock, Plus, X, Search, UserPlus, UserMinus, AlertTriangle, Edit2, Trash2, Check, Loader2 } from 'lucide-react';
import { renderMessageContent } from '../utils/messageRenderer';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Chat = () => {
    const { user } = useAuth();
    const { 
        rooms, activeRoomId, messages, onlineUsers, allUsers,
        isLoadingMessages, isSending,
        selectRoom, startDM, createChannel, createGroup, deleteRoom, // ✅ Added deleteRoom
        addMember, kickMember, 
        sendMessage, editMessage, deleteMessage,
        getRoomDetails 
    } = useChat();

    const scrollRef = useRef<HTMLDivElement>(null);
    
    // --- UI STATE ---
    const [isCreatingChannel, setIsCreatingChannel] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [isSearchingUser, setIsSearchingUser] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    // Loaders
    const [isSubmitting, setIsSubmitting] = useState(false); // For creation
    const [loadingId, setLoadingId] = useState<string | null>(null); // For deletion (per item)

    // Modals
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [memberToKick, setMemberToKick] = useState<{ id: string, name: string } | null>(null);
    const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
    const [roomToDelete, setRoomToDelete] = useState<{ id: string, name: string } | null>(null); // ✅ Room Delete Modal

    // Editing
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');

    // Auto-scroll logic
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, editingMessageId]);

    // Derived Lists
    const activeRoom = useMemo(() => rooms.find(r => r.id === activeRoomId), [rooms, activeRoomId]);
    const channels = rooms.filter(r => r.type === 'global' || r.type === 'channel');
    const groups = rooms.filter(r => r.type === 'group');
    const dms = rooms.filter(r => r.type === 'dm');

    // Sidebar Users Logic
    const sidebarUsers = useMemo(() => {
        if (activeRoom && activeRoom.type === 'group') {
            return activeRoom.memberships
                .map(m => ({
                    userId: m.user.id,
                    name: m.user.name,
                    avatar: m.user.avatar,
                    isOnline: onlineUsers.some(o => o.userId === m.user.id)
                }))
                .sort((a, b) => Number(b.isOnline) - Number(a.isOnline));
        }
        
        const unique = new Map();
        onlineUsers.forEach(u => { if (u.userId !== user?.id) unique.set(u.userId, { ...u, isOnline: true }); });
        allUsers.forEach(u => { if (u.id !== user?.id && !unique.has(u.id)) unique.set(u.id, { userId: u.id, name: u.name, avatar: u.avatar, isOnline: false }); });
        return Array.from(unique.values());
    }, [activeRoom, onlineUsers, allUsers, user?.id]);

    const filteredSidebarUsers = useMemo(() => {
        if (!userSearchQuery) return sidebarUsers;
        return sidebarUsers.filter((u: any) => u.name.toLowerCase().includes(userSearchQuery.toLowerCase()));
    }, [sidebarUsers, userSearchQuery]);

    // Candidates for Add Member
    const candidatesForGroup = useMemo(() => {
        if (!activeRoom || activeRoom.type !== 'group') return [];
        const existingMemberIds = new Set(activeRoom.memberships.map(m => m.user.id));
        const fullDirectory = allUsers.filter(u => u.id !== user?.id); 
        return fullDirectory.filter((u: any) => !existingMemberIds.has(u.id) && u.name.toLowerCase().includes(memberSearchQuery.toLowerCase()));
    }, [allUsers, activeRoom, memberSearchQuery, user?.id]);

    // --- HANDLERS ---
    
    // Create Channel
    const handleCreateChannel = async () => {
        if (newChannelName.trim()) {
            setIsSubmitting(true);
            await createChannel(newChannelName);
            // Simulate delay for UX or wait for socket (optimistic)
            setTimeout(() => {
                setNewChannelName('');
                setIsCreatingChannel(false);
                setIsSubmitting(false);
            }, 500);
        }
    };

    // Create Group
    const handleCreateGroup = async () => {
        if (newGroupName.trim()) {
            setIsSubmitting(true);
            await createGroup(newGroupName);
            setTimeout(() => {
                setNewGroupName('');
                setIsCreatingGroup(false);
                setIsSubmitting(false);
            }, 500);
        }
    };

    // Confirm Delete Room
    const confirmDeleteRoom = () => {
        if (roomToDelete) {
            setLoadingId(roomToDelete.id);
            deleteRoom(roomToDelete.id);
            // We don't turn off loadingId here immediately; it turns off when the room disappears from list
            setRoomToDelete(null);
        }
    };

    const handleAddMember = (targetUserId: string) => { if (activeRoomId) { addMember(targetUserId, activeRoomId); setIsAddingMember(false); setMemberSearchQuery(''); toast.success("Member added!"); } };
    const confirmKick = () => { if (memberToKick && activeRoomId) { kickMember(memberToKick.id, activeRoomId); setMemberToKick(null); toast.info("Member removed."); } };
    
    // Message Handlers
    const startEditing = (msg: any) => { setEditingMessageId(msg.id); setEditContent(msg.content); };
    const saveEdit = () => { if (editingMessageId && editContent.trim()) { editMessage(editingMessageId, editContent); setEditingMessageId(null); setEditContent(''); } };
    const confirmDeleteMessage = () => { if (messageToDelete) { deleteMessage(messageToDelete); setMessageToDelete(null); } };

    if (!user) return null;

    return (
        <div className="flex h-screen bg-white dark:bg-[#0B0D0F] text-slate-800 dark:text-slate-100 font-sans overflow-hidden">
            <ToastContainer theme="dark" position="top-right" />
            
            {/* --- LEFT SIDEBAR (Rooms) --- */}
            <div className="w-64 bg-gray-50 dark:bg-[#15171B] flex flex-col border-r border-gray-200 dark:border-white/5">
                <div className="h-16 flex items-center px-5 font-bold text-lg border-b border-gray-200 dark:border-white/5">CapyChat</div>
                <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
                    
                    {/* 1. CHANNELS */}
                    <div>
                        <div className="px-2 mb-2 flex items-center justify-between group">
                            <span className="text-xs font-bold text-gray-400">CHANNELS</span>
                            <button onClick={() => setIsCreatingChannel(true)} className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100"><Plus size={16} /></button>
                        </div>
                        
                        {/* Creation Input */}
                        {isCreatingChannel && (
                            <div className="px-2 mb-2">
                                <div className="flex items-center gap-1 bg-white dark:bg-black/20 border border-blue-500 rounded px-2 py-1">
                                    {isSubmitting ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <Hash size={14} className="text-gray-400" />}
                                    <input 
                                        autoFocus
                                        disabled={isSubmitting}
                                        className="w-full bg-transparent outline-none text-sm"
                                        placeholder="new-channel"
                                        value={newChannelName}
                                        onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreateChannel();
                                            if (e.key === 'Escape') setIsCreatingChannel(false);
                                        }}
                                    />
                                    {/* Cancel Button */}
                                    <button onClick={() => setIsCreatingChannel(false)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                                </div>
                            </div>
                        )}

                        {channels.map(room => {
                            // Check if I am Admin (to show delete)
                            // Note: For public channels, usually only creator/admin has role 'ADMIN'.
                            const isAdmin = room.memberships.find(m => m.user.id === user.id)?.role === 'ADMIN';

                            return (
                                <div key={room.id} onClick={() => selectRoom(room.id)} className={`group/item flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer ${activeRoomId === room.id ? 'bg-blue-600/10 text-blue-500 font-bold' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500'}`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Hash size={18} className="shrink-0"/>
                                        <span className="truncate">{room.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {loadingId === room.id ? (
                                            <Loader2 size={14} className="animate-spin text-gray-400" />
                                        ) : (
                                            isAdmin && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setRoomToDelete({ id: room.id, name: room.name }); }}
                                                    className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded transition-all"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )
                                        )}
                                        {room.unreadCount! > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{room.unreadCount}</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 2. PRIVATE GROUPS */}
                    <div>
                        <div className="px-2 mb-2 flex items-center justify-between group">
                            <span className="text-xs font-bold text-gray-400">PRIVATE GROUPS</span>
                            <button onClick={() => setIsCreatingGroup(true)} className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100"><Plus size={16} /></button>
                        </div>
                        
                        {/* Creation Input */}
                        {isCreatingGroup && (
                            <div className="px-2 mb-2">
                                <div className="flex items-center gap-1 bg-white dark:bg-black/20 border border-blue-500 rounded px-2 py-1">
                                    {isSubmitting ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <Lock size={14} className="text-gray-400" />}
                                    <input 
                                        autoFocus
                                        disabled={isSubmitting}
                                        className="w-full bg-transparent outline-none text-sm"
                                        placeholder="Group Name"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreateGroup();
                                            if (e.key === 'Escape') setIsCreatingGroup(false);
                                        }}
                                    />
                                    <button onClick={() => setIsCreatingGroup(false)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                                </div>
                            </div>
                        )}

                        {groups.map(room => {
                            const isAdmin = room.memberships.find(m => m.user.id === user.id)?.role === 'ADMIN';
                            return (
                                <div key={room.id} onClick={() => selectRoom(room.id)} className={`group/item flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer ${activeRoomId === room.id ? 'bg-blue-600/10 text-blue-500 font-bold' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500'}`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Lock size={16} className="shrink-0"/>
                                        <span className="truncate">{room.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {loadingId === room.id ? (
                                            <Loader2 size={14} className="animate-spin text-gray-400" />
                                        ) : (
                                            isAdmin && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setRoomToDelete({ id: room.id, name: room.name }); }}
                                                    className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded transition-all"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )
                                        )}
                                        {room.unreadCount! > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{room.unreadCount}</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 3. DIRECT MESSAGES */}
                    <div>
                        <div className="px-2 mb-2 flex items-center justify-between group"><span className="text-xs font-bold text-gray-400">DIRECT MESSAGES</span><button onClick={() => setIsSearchingUser(!isSearchingUser)} className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100"><Plus size={16} /></button></div>
                        {isSearchingUser && <div className="px-2 mb-2"><div className="flex items-center gap-1 bg-white dark:bg-black/20 border border-gray-300 dark:border-white/20 rounded px-2 py-1"><Search size={14} className="text-gray-400"/><input autoFocus className="w-full bg-transparent outline-none text-sm" placeholder="Search user..." value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)} /><button onClick={() => setIsSearchingUser(false)} className="text-gray-400 hover:text-red-500"><X size={14}/></button></div></div>}
                        {dms.map(room => {
                            const details = getRoomDetails(room);
                            return (
                                <div key={room.id} onClick={() => selectRoom(room.id)} className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer ${activeRoomId === room.id ? 'bg-blue-600/10 text-blue-500 font-bold' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500'}`}>
                                    <div className="flex items-center gap-2 overflow-hidden"><div className="relative shrink-0 w-5 h-5 rounded-full bg-gray-300 overflow-hidden">{details.avatar && <img src={details.avatar} className="w-full h-full object-cover" />}</div><span className="truncate">{details.name}</span></div>
                                    <div className="flex items-center gap-1">{details.isOnline && <div className="w-2 h-2 bg-green-500 rounded-full" />}{room.unreadCount! > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{room.unreadCount}</span>}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* MAIN CHAT AREA */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="h-16 border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-6">
                    <div className="font-bold text-lg flex items-center gap-2">
                        {activeRoom ? <>{activeRoom.type === 'group' ? <Lock size={20}/> : activeRoom.type === 'dm' ? null : <Hash size={20}/>}{getRoomDetails(activeRoom).name}</> : 'Select a chat'}
                    </div>
                    {activeRoom?.type === 'group' && <button onClick={() => setIsAddingMember(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-blue-600" title="Add Member"><UserPlus size={20} /></button>}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar" ref={scrollRef}>
                    {isLoadingMessages && <div className="text-center text-gray-500 mt-10">Loading history...</div>}
                    {!isLoadingMessages && messages.length === 0 && <div className="text-center text-gray-500 mt-10">No messages yet.</div>}
                    
                    {messages.map((msg, i) => {
                        if (msg.attachmentType === 'system') return <div key={msg.id} className="flex justify-center my-4"><div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 px-3 py-1 rounded-full text-xs text-gray-500 dark:text-gray-400 font-medium">{msg.content}</div></div>;

                        const isMe = msg.userId === user.id;
                        const showHeader = i === 0 || messages[i-1].userId !== msg.userId || messages[i-1].attachmentType === 'system';
                        const isEditing = editingMessageId === msg.id;

                        return (
                            <div key={msg.id} className={`group flex flex-col mb-1 ${isMe ? 'items-end' : 'items-start'}`}>
                                {showHeader && <span className="text-xs text-gray-400 mt-2 mb-1 ml-1">{msg.user.name}</span>}
                                <div className="relative max-w-[70%]">
                                    <div className={`px-4 py-2 rounded-2xl ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-200 dark:bg-white/10 rounded-bl-none'}`}>
                                        {msg.attachmentUrl && (<div className="mb-2 mt-1"><img src={msg.attachmentUrl} className="max-w-full max-h-[300px] rounded-lg object-cover cursor-pointer border border-black/10 dark:border-white/10" onClick={() => window.open(msg.attachmentUrl, '_blank')} /></div>)}
                                        {isEditing ? (
                                            <div className="flex items-center gap-2 min-w-[200px]"><input autoFocus className="flex-1 bg-white/20 text-white border border-white/30 rounded px-2 py-1 text-sm outline-none" value={editContent} onChange={(e) => setEditContent(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingMessageId(null); }} /><button onClick={saveEdit} className="p-1 hover:bg-white/20 rounded"><Check size={14} /></button><button onClick={() => setEditingMessageId(null)} className="p-1 hover:bg-white/20 rounded"><X size={14} /></button></div>
                                        ) : (
                                            <div>{renderMessageContent(msg.content)}{msg.updatedAt && msg.createdAt && new Date(msg.updatedAt).getTime() > new Date(msg.createdAt).getTime() && <span className="text-[10px] opacity-60 ml-1 italic">(edited)</span>}</div>
                                        )}
                                    </div>
                                    {isMe && !isEditing && (<div className="absolute top-1/2 -translate-y-1/2 -left-16 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white dark:bg-[#1E1F22] shadow-sm border border-gray-200 dark:border-white/10 rounded-lg p-1"><button onClick={() => startEditing(msg)} className="p-1.5 text-gray-500 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded" title="Edit"><Edit2 size={12} /></button><button onClick={() => setMessageToDelete(msg.id)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Delete"><Trash2 size={12} /></button></div>)}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-[#15171B]"><ChatInput onSendMessage={sendMessage} isLoading={isSending} /></div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="w-64 bg-white dark:bg-[#15171B] border-l border-gray-200 dark:border-white/5 p-4 overflow-y-auto hidden lg:block">
                <div className="text-xs font-bold text-gray-400 mb-4">{activeRoom?.type === 'group' ? 'GROUP MEMBERS' : 'ALL MEMBERS'}</div>
                {filteredSidebarUsers.map((u: any) => (
                    <div key={u.userId} onClick={() => startDM(u.userId)} className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg cursor-pointer group">
                        <div className="relative"><div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 overflow-hidden">{u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : null}</div>{u.isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#15171B] rounded-full" />}</div>
                        <span className="text-sm font-medium flex-1 truncate">{u.name}</span>
                        {activeRoom?.type === 'group' && u.userId !== user.id && (
                            <button onClick={(e) => { e.stopPropagation(); setMemberToKick({ id: u.userId, name: u.name }); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Remove Member"><UserMinus size={14} /></button>
                        )}
                    </div>
                ))}
            </div>

            {/* Modals */}
            {isAddingMember && activeRoom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95"><div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-white/5"><h3 className="text-lg font-bold text-gray-900 dark:text-white">Add to {activeRoom.name}</h3><button onClick={() => setIsAddingMember(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg"><X size={20} className="text-gray-500" /></button></div><div className="p-4"><div className="relative mb-4"><Search className="absolute left-3 top-2.5 text-gray-400" size={18} /><input autoFocus type="text" placeholder="Search people..." className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none text-gray-900 dark:text-white" value={memberSearchQuery} onChange={(e) => setMemberSearchQuery(e.target.value)} /></div><div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-1">{candidatesForGroup.length === 0 ? <p className="text-center text-gray-500 text-sm py-4">No new users to add.</p> : candidatesForGroup.map((u: any) => (<div key={u.id} onClick={() => handleAddMember(u.id)} className="flex items-center gap-3 p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg cursor-pointer group"><div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-bold">{u.name.charAt(0)}</div><div className="flex-1 font-medium text-gray-900 dark:text-white">{u.name}</div><Plus size={16} className="text-blue-500 opacity-0 group-hover:opacity-100" /></div>))}</div></div></div></div>
            )}

            {memberToKick && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm bg-white dark:bg-[#1A1D21] border border-red-200 dark:border-red-900/50 rounded-xl shadow-2xl p-6 animate-in zoom-in-95"><div className="flex flex-col items-center text-center mb-6"><div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 mb-4"><AlertTriangle size={24} /></div><h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Remove Member?</h3><p className="text-sm text-gray-500 dark:text-gray-400">Are you sure you want to remove <span className="font-bold text-gray-800 dark:text-gray-200">{memberToKick.name}</span>?</p></div><div className="flex gap-3"><button onClick={() => setMemberToKick(null)} className="flex-1 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white rounded-lg">Cancel</button><button onClick={confirmKick} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Remove</button></div></div></div>
            )}

            {messageToDelete && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl p-6 animate-in zoom-in-95"><div className="text-center mb-6"><h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Message?</h3><p className="text-sm text-gray-500">This action cannot be undone.</p></div><div className="flex gap-3"><button onClick={() => setMessageToDelete(null)} className="flex-1 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white rounded-lg">Cancel</button><button onClick={confirmDeleteMessage} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button></div></div></div>
            )}

            {/* ✅ NEW: Delete Room Modal */}
            {roomToDelete && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-sm bg-white dark:bg-[#1A1D21] border border-red-200 dark:border-red-900/50 rounded-xl shadow-2xl p-6 animate-in zoom-in-95">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 mb-4"><Trash2 size={24} /></div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Room?</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Are you sure you want to delete <span className="font-bold text-gray-800 dark:text-gray-200">{roomToDelete.name}</span>? This cannot be undone.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setRoomToDelete(null)} className="flex-1 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white rounded-lg">Cancel</button>
                            <button onClick={confirmDeleteRoom} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;