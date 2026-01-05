import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { 
  Trash2, Edit2, X, Hash, Plus, Search, Users, 
  MoreHorizontal, Loader2, MessageCircle, Lock, UserPlus, Info, UserMinus, AlertTriangle, 
  FileText, Download, Smile, MessageSquare, Bell 
} from 'lucide-react';
// import { useAuth } from '../context/AuthContext'; 
// ✅ Ensure Notification type is imported
import { useChat, type Channel, type ActiveDM, type UserData, type Notification } from '../hooks/useChat'; 
import RichLinkPreview from '../components/RichLinkPreview';
import ChatInput from '../components/ChatInput'; 
import { renderMessageContent } from '../utils/messageRenderer';
import { ToastContainer, toast } from 'react-toastify';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react'; 
import 'react-toastify/dist/ReactToastify.css';

// --- HELPERS ---
const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const isNewDay = (d1?: string, d2?: string) => {
    if (!d1 || !d2) return false;
    return new Date(d1).toDateString() !== new Date(d2).toDateString();
};

const getDateLabel = (isoString: string) => {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
};

// --- SKELETONS ---
const ChannelSkeleton = () => (
    <div className="flex flex-col gap-2 px-2 animate-pulse">
        {[1, 2, 3].map(i => <div key={i} className="h-9 bg-gray-200 dark:bg-white/5 rounded-lg w-full" />)}
    </div>
);

const MessageSkeleton = () => (
    <div className="flex flex-col gap-6 px-6 py-4 animate-pulse">
        {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/5 shrink-0" />
                <div className="flex flex-col gap-2 w-full">
                    <div className="h-4 bg-gray-200 dark:bg-white/5 rounded w-24" />
                    <div className="h-4 bg-gray-200 dark:bg-white/5 rounded w-full" />
                </div>
            </div>
        ))}
    </div>
);

// --- MEMOIZED COMPONENTS ---

const ChannelItem = React.memo(({ 
    channel, isActive, onClick, onDelete 
}: { 
    channel: Channel, isActive: boolean, onClick: () => void, onDelete: (e: React.MouseEvent, id: string) => void 
}) => (
    <div onClick={onClick} className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-600/10 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
        <div className="flex items-center gap-2.5 overflow-hidden">
            {channel.type === 'group' ? <Lock size={16} /> : <Hash size={18} />}
            <span className={`text-sm truncate ${channel.unreadCount && channel.unreadCount > 0 ? 'font-bold text-gray-900 dark:text-white' : ''}`}>
                {channel.name}
            </span>
        </div>
        {channel.unreadCount && channel.unreadCount > 0 ? (
            <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 h-4 flex items-center justify-center rounded-full">
                {channel.unreadCount}
            </div>
        ) : (
            <button onClick={(e) => onDelete(e, channel.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1"><Trash2 size={12} /></button>
        )}
    </div>
));

const DMItem = React.memo(({ 
    dm, isActive, onClick 
}: { 
    dm: ActiveDM, isActive: boolean, onClick: () => void 
}) => (
    <div onClick={onClick} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-600/10 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
        <div className="relative shrink-0"><div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 overflow-hidden">{dm.avatar ? <img src={dm.avatar} className="w-full h-full object-cover"/> : null}</div><div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-[#15171B]"></div></div>
        <span className="text-sm truncate">{dm.name}</span>
    </div>
));

const MessageBubble = React.memo(({ 
    msg, prevMsg, user, isEditing, editText, setEditText, setEditingMessageId, handleSaveEdit, handleDeleteMessage, openThread, toggleReaction, handleOpenReaction, setLightboxImage 
}: any) => {
    const showDateDivider = !prevMsg || isNewDay(msg.createdAt, prevMsg.createdAt);
    const isSequence = !showDateDivider && prevMsg && prevMsg.userId === msg.userId && (new Date(msg.createdAt!).getTime() - new Date(prevMsg.createdAt!).getTime() < 5 * 60 * 1000);
    const isMe = msg.userId === user.id;
    
    // Memoize calculations
    const reactionCounts = useMemo(() => msg.reactions?.reduce((acc: any, r: any) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
    }, {}), [msg.reactions]);

    const replyCount = msg._count?.replies || 0;

    return (
        <div className="flex flex-col">
            {showDateDivider && <div className="relative flex items-center justify-center my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-white/10"></div></div><span className="relative z-10 px-4 text-xs font-semibold text-gray-500 bg-white dark:bg-[#0B0D0F]">{getDateLabel(msg.createdAt!)}</span></div>}
            
            <div className={`group relative flex items-start gap-4 px-2 py-1 hover:bg-gray-50 dark:hover:bg-white/5 -mx-2 rounded-lg transition-colors ${isSequence ? 'mt-0.5' : 'mt-4'}`}>
                {/* Avatar Column */}
                <div className="w-[40px] shrink-0 flex flex-col items-center">
                    {!isSequence ? (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm overflow-hidden">
                            {msg.user.avatar ? <img src={msg.user.avatar} className="w-full h-full object-cover" alt={msg.user.name} /> : msg.user.name.charAt(0).toUpperCase()}
                        </div>
                    ) : <div className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 mt-1.5 select-none">{formatTime(msg.createdAt)}</div>}
                </div>

                {/* Content Column */}
                <div className="flex-1 min-w-0">
                    {!isSequence && <div className="flex items-center gap-2 mb-1"><span className="font-bold text-gray-900 dark:text-white cursor-pointer hover:underline">{msg.user.name}</span><span className="text-xs text-gray-500 dark:text-gray-400">{formatTime(msg.createdAt)}</span></div>}
                    
                    {isEditing ? (
                        <div className="bg-gray-50 dark:bg-[#15171B] p-3 rounded-lg w-full border border-blue-200 dark:border-blue-900/50">
                            <textarea autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); } else if(e.key === 'Escape') setEditingMessageId(null); }} className="w-full bg-transparent border-none outline-none text-sm resize-none font-sans text-gray-900 dark:text-white" rows={2}/>
                            <div className="flex justify-end gap-2 mt-2"><button onClick={() => setEditingMessageId(null)} className="text-xs text-gray-500 hover:underline">Cancel (Esc)</button><button onClick={handleSaveEdit} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors">Save</button></div>
                        </div>
                    ) : (
                        <div className="text-[15px] text-gray-800 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-medium">
                            {msg.content && renderMessageContent(msg.content)}
                            {msg.updatedAt && msg.createdAt && (new Date(msg.updatedAt).getTime() - new Date(msg.createdAt).getTime() > 2000) && <span className="text-[10px] text-gray-400 ml-1 select-none">(edited)</span>}
                            {!isEditing && msg.content.match(/(https?:\/\/[^\s]+)/g)?.find((link: string) => link.includes('/assets/')) && <div className="mt-2 max-w-[400px]"><RichLinkPreview url={msg.content.match(/(https?:\/\/[^\s]+)/g)!.find((link: string) => link.includes('/assets/'))!}/></div>}
                            {msg.attachmentUrl && (
                                <div className="mt-2">
                                    {msg.attachmentType?.startsWith('image/') ? (
                                        <div className="relative group/image max-w-sm rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-sm">
                                            <img src={msg.attachmentUrl} alt={msg.attachmentName || 'Attachment'} className="w-full h-auto max-h-[350px] object-cover cursor-zoom-in transition-transform hover:scale-[1.02]" onClick={() => setLightboxImage(msg.attachmentUrl!)}/>
                                        </div>
                                    ) : (
                                        <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-[#15171B] border border-gray-200 dark:border-white/5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-all max-w-xs group/file">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-600/20 rounded-lg text-blue-600 dark:text-blue-400"><FileText size={24} /></div>
                                            <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{msg.attachmentName || 'Attached File'}</div><div className="text-xs text-gray-500 dark:text-gray-400 group-hover/file:text-blue-600 dark:group-hover/file:text-blue-400 transition-colors">Click to download</div></div>
                                            <Download size={18} className="text-gray-400 dark:text-gray-500 group-hover/file:text-blue-600 dark:group-hover/file:text-blue-400 transition-colors" />
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2 mt-1">
                        {msg.reactions && msg.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(reactionCounts || {}).map(([emoji, count]: any) => {
                                    const hasMe = msg.reactions?.some((r: any) => r.emoji === emoji && r.userId === user.id);
                                    return (
                                        <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-md border transition-colors ${hasMe ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' : 'bg-gray-100 dark:bg-white/5 border-transparent hover:border-gray-300 dark:hover:border-white/20'}`}>
                                            <span>{emoji}</span><span className="text-gray-600 dark:text-gray-400 font-medium">{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {replyCount > 0 && (
                            <div onClick={() => openThread(msg)} className="flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-blue-400 cursor-pointer select-none">
                                <div className="flex -space-x-2 mr-1">{[...Array(Math.min(3, replyCount))].map((_, idx) => <div key={idx} className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-[#0B0D0F]"></div>)}</div>
                                {replyCount} replies <span className="text-[10px] text-gray-400 font-normal ml-1">Last reply today at {formatTime(msg.updatedAt)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {!isEditing && (
                    <div className="absolute right-4 -top-3 opacity-0 group-hover:opacity-100 bg-white dark:bg-[#1E1F22] shadow-md border border-gray-200 dark:border-white/10 rounded-md flex overflow-hidden transition-opacity z-10">
                        <button onClick={(e) => handleOpenReaction(e, msg.id)} className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors" title="Add Reaction"><Smile size={14} /></button>
                        <button onClick={() => openThread(msg)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Reply in Thread"><MessageSquare size={14} /></button>
                        {isMe && (
                            <>
                                <button onClick={() => { setEditingMessageId(msg.id); setEditText(msg.content); }} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Edit"><Edit2 size={14} /></button>
                                <button onClick={() => handleDeleteMessage(msg.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete"><Trash2 size={14} /></button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

// --- MAIN COMPONENT ---

const Chat = () => {
  const { 
    user, activeRoom, activeDM, channels, activeDMs, messages, 
    onlineUsers, allUsers, isLoadingChannels, isLoadingMessages, isSending, typingUsers,
    isFetchingHistory, hasMore, loadMoreMessages,
    joinRoom, switchToDM, startDM, createChannel, createGroup, deleteChannel,
    addMember, kickMember, sendMessage, sendTyping, deleteMessage, editMessage,
    addReaction, removeReaction,
    activeThread, openThread, closeThread, sendThreadMessage,
    // ✅ Ensure these are destructured from the hook
    notifications = [], 
    unreadMentionCount = 0, 
    markNotificationsRead = () => {}
  } = useChat();

  const [showMembers, setShowMembers] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  // Modals & Popups
  const [isCreatingChannel, setIsCreatingChannel] = useState(false); 
  const [isCreatingGroup, setIsCreatingGroup] = useState(false); 
  const [isAddingMember, setIsAddingMember] = useState(false); 
  const [isViewingMembers, setIsViewingMembers] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [memberToKick, setMemberToKick] = useState<{ id: string, name: string } | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [channelToDeleteId, setChannelToDeleteId] = useState<string | null>(null); 
  const [_isKickingLoading, setIsKickingLoading] = useState(false);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);
  
  const [reactingToMessageId, setReactingToMessageId] = useState<string | null>(null);
  const [pickerPlacement, setPickerPlacement] = useState<'above' | 'below'>('above');

  const [newChannelName, setNewChannelName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); 
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const [prevScrollHeight, setPrevScrollHeight] = useState(0);
  const reactionPickerRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolled = useRef(false);

  // Derived Data
  const parentMessage = useMemo(() => messages.find(msg => msg.id === activeThread?.id), [messages, activeThread]);
  const publicChannels = useMemo(() => channels.filter(c => c.type === 'channel'), [channels]);
  const privateGroups = useMemo(() => channels.filter(c => c.type === 'group'), [channels]);
  const currentGroup = useMemo(() => privateGroups.find(g => g.name === activeRoom), [privateGroups, activeRoom]);

  // Handle outside clicks
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (reactionPickerRef.current && !reactionPickerRef.current.contains(event.target as Node)) {
              setReactingToMessageId(null);
          }
          if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
              setShowNotifications(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto Scroll logic
  useEffect(() => { hasInitialScrolled.current = false; }, [activeRoom]);
  useEffect(() => { 
      if (!scrollRef.current || messages.length === 0) return;
      if (!hasInitialScrolled.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          hasInitialScrolled.current = true;
      }
  }, [messages, activeRoom]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight } = e.currentTarget;
      if (scrollTop === 0 && hasMore && !isFetchingHistory) {
          setPrevScrollHeight(scrollHeight); 
          loadMoreMessages();
      }
  }, [hasMore, isFetchingHistory, loadMoreMessages]);

  useLayoutEffect(() => {
      if (!isFetchingHistory && prevScrollHeight > 0 && scrollRef.current) {
          const newHeight = scrollRef.current.scrollHeight;
          scrollRef.current.scrollTop = newHeight - prevScrollHeight;
          setPrevScrollHeight(0);
      }
  }, [messages, isFetchingHistory, prevScrollHeight]);

  // Handlers
  const handleCreateChannel = () => { createChannel(newChannelName); setIsCreatingChannel(false); setNewChannelName(''); };
  const handleCreateGroup = () => { createGroup(newGroupName); setIsCreatingGroup(false); setNewGroupName(''); };
  
  const handleAddMemberAction = (uid: string) => { 
      setAddingMemberId(uid); 
      addMember(currentGroup?.id!, uid); 
      setTimeout(() => { setAddingMemberId(null); setIsAddingMember(false); toast.success('Member added'); }, 500); 
  };
  
  const handleKickAction = () => { 
      if (memberToKick && currentGroup) { 
          setIsKickingLoading(true);
          kickMember(currentGroup.id, memberToKick.id); 
          setMemberToKick(null); 
          setIsKickingLoading(false);
          toast.success('Removed'); 
      }
  };
  
  const handleDeleteChannelClick = useCallback((e: React.MouseEvent, id: string) => { e.stopPropagation(); setChannelToDeleteId(id); }, []);
  
  const confirmDeleteChannel = () => { 
      if (channelToDeleteId) { 
          setIsDeletingLoading(true);
          deleteChannel(channelToDeleteId); 
          setTimeout(() => {
              setChannelToDeleteId(null); 
              setIsDeletingLoading(false);
              toast.success('Channel deleted'); 
          }, 1000);
      } 
  };
  
  const handleDeleteMessage = useCallback((id: string) => setMessageToDelete(id), []);
  const confirmDeleteMessage = () => { if (messageToDelete) { deleteMessage(messageToDelete); setMessageToDelete(null); }};
  
  const handleSaveEdit = useCallback(() => { 
      if(editingMessageId) editMessage(editingMessageId, editText); 
      setEditingMessageId(null); 
  }, [editingMessageId, editText, editMessage]);

  const handleOpenReaction = useCallback((e: React.MouseEvent, msgId: string) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setPickerPlacement(rect.top < 400 ? 'below' : 'above');
      setReactingToMessageId(msgId);
  }, []);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
      if (reactingToMessageId) {
          addReaction(reactingToMessageId, emojiData.emoji);
          setReactingToMessageId(null);
      }
  };

  const toggleReaction = useCallback((msgId: string, emoji: string) => {
      const msg = messages.find(m => m.id === msgId);
      if (!msg || !user) return;
      const hasReacted = msg.reactions?.some(r => r.emoji === emoji && r.userId === user.id);
      if (hasReacted) removeReaction(msgId, emoji); else addReaction(msgId, emoji);
  }, [messages, user, addReaction, removeReaction]);

  // ✅ Notification Handlers
  const toggleNotifications = () => {
      if (!showNotifications) markNotificationsRead();
      setShowNotifications(!showNotifications);
  };

  const handleNotificationClick = (notif: Notification) => {
      joinRoom(notif.roomName || notif.roomId);
      setShowNotifications(false);
  };

  const getSidebarMembers = useMemo(() => {
      const baseList = currentGroup && currentGroup.members ? currentGroup.members : allUsers;
      const online: UserData[] = [], offline: UserData[] = [];
      baseList.forEach(u => { if (onlineUsers.some(o => o.userId === u.id)) online.push(u); else offline.push(u); });
      return { online: online.sort((a,b)=>a.name.localeCompare(b.name)), offline: offline.sort((a,b)=>a.name.localeCompare(b.name)) };
  }, [currentGroup, allUsers, onlineUsers]);

  const { online: onlineMembersList, offline: offlineMembersList } = getSidebarMembers;

  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-screen overflow-hidden font-sans bg-white dark:bg-[#0B0D0F] relative text-slate-800 dark:text-slate-100">
      <ToastContainer theme="dark" autoClose={3000} position="top-right" />

      {/* 1. SIDEBAR */}
      <div className="w-64 bg-gray-50 dark:bg-[#15171B] flex flex-col shrink-0 hidden md:flex border-r border-gray-200 dark:border-white/5">
         
         {/* HEADER WITH BELL ICON */}
         <div className="h-16 flex items-center px-5 border-b border-gray-200 dark:border-white/5 relative z-20">
             <h1 className="absolute left-1/2 -translate-x-1/2 font-bold text-gray-900 dark:text-white truncate tracking-tight text-lg">CapyChat</h1>
             
             {/* Bell Icon & Dropdown */}
             <div className="ml-auto relative" ref={notificationRef}>
                 <button 
                    onClick={toggleNotifications} 
                    className={`p-2 rounded-full transition-colors ${showNotifications ? 'bg-blue-100 text-blue-600 dark:bg-white/10 dark:text-white' : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'}`}
                 >
                     <Bell size={20} />
                     {unreadMentionCount > 0 && (
                         <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                         </span>
                     )}
                 </button>

                 {/* Dropdown Menu */}
                 {showNotifications && (
                     <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#1E1F22] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                         <div className="p-3 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#15171B]">
                             <h3 className="text-xs font-bold text-gray-500 uppercase">Mentions & Updates</h3>
                         </div>
                         <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                             {notifications.length === 0 ? (
                                 <div className="p-8 text-center text-gray-400 text-sm">No new mentions</div>
                             ) : (
                                 notifications.map((notif, i) => (
                                     <div 
                                        key={i} 
                                        onClick={() => handleNotificationClick(notif)}
                                        className="p-3 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer border-b border-gray-100 dark:border-white/5 last:border-0 transition-colors"
                                     >
                                         <div className="flex items-center gap-2 mb-1">
                                             <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] text-white font-bold">
                                                 {notif.senderName.charAt(0)}
                                             </div>
                                             <span className="font-bold text-sm text-gray-900 dark:text-white">{notif.senderName}</span>
                                             <span className="text-xs text-gray-400">in #{notif.roomName}</span>
                                         </div>
                                         <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 pl-7">
                                             {notif.text}
                                         </p>
                                         <div className="text-[10px] text-gray-400 pl-7 mt-1">{new Date(notif.createdAt).toLocaleTimeString()}</div>
                                     </div>
                                 ))
                             )}
                         </div>
                     </div>
                 )}
             </div>
         </div>

         <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
             {/* CHANNELS */}
             <div>
                <div className="px-2 mb-2 flex items-center justify-between group cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Text Channels</span>
                    <Plus size={14} onClick={() => setIsCreatingChannel(true)} />
                </div>
                {isCreatingChannel && <div className="px-2 mb-2 animate-in fade-in slide-in-from-top-1"><input autoFocus className="w-full bg-white dark:bg-black/20 border border-blue-500 rounded px-2 py-1.5 text-sm dark:text-white outline-none" placeholder="new-channel..." value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChannel(); }} /></div>}
                {isLoadingChannels ? <ChannelSkeleton /> : 
                <div className="space-y-0.5">{publicChannels.map(ch => (
                    <ChannelItem key={ch.id} channel={ch} isActive={activeRoom === ch.name} onClick={() => joinRoom(ch.name)} onDelete={handleDeleteChannelClick} />
                ))}</div>}
             </div>
             {/* GROUPS */}
             <div>
                <div className="px-2 mb-2 flex items-center justify-between group cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Private Groups</span>
                    <Plus size={14} onClick={() => setIsCreatingGroup(true)} />
                </div>
                {isCreatingGroup && <div className="px-2 mb-4 bg-gray-100 dark:bg-white/5 p-3 rounded-lg animate-in fade-in slide-in-from-top-1"><input autoFocus className="w-full bg-white dark:bg-black/20 border border-gray-300 dark:border-white/20 rounded px-2 py-1 text-sm dark:text-white outline-none mb-2" placeholder="Group Name..." value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} /><div className="flex gap-2"><button onClick={handleCreateGroup} disabled={!newGroupName} className="flex-1 bg-blue-600 text-white text-xs py-1 rounded hover:bg-blue-700">Create</button><button onClick={() => setIsCreatingGroup(false)} className="flex-1 bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-xs py-1 rounded hover:bg-gray-300 dark:hover:bg-white/20">Cancel</button></div></div>}
                <div className="space-y-0.5">{privateGroups.map(ch => (
                    <ChannelItem key={ch.id} channel={ch} isActive={activeRoom === ch.name} onClick={() => joinRoom(ch.name)} onDelete={handleDeleteChannelClick} />
                ))}</div>
             </div>
             {/* DMs */}
             {activeDMs.length > 0 && <div>
                <div className="px-2 mb-2 mt-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Direct Messages</div>
                <div className="space-y-0.5">{activeDMs.map(dm => (
                    <DMItem key={dm.userId} dm={dm} isActive={activeRoom === dm.roomId} onClick={() => switchToDM(dm)} />
                ))}</div>
             </div>}
         </div>
      </div>

      {/* 2. MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0B0D0F] relative">
         <div className="h-16 border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-6 shrink-0 bg-white/80 dark:bg-[#0B0D0F]/90 backdrop-blur-md sticky top-0 z-10">
             <div className="flex items-center gap-3">
                 {activeDM ? <MessageCircle size={24} className="text-gray-400"/> : currentGroup ? <Lock size={24} className="text-gray-400"/> : <Hash size={24} className="text-gray-400" />}
                 <div><h2 className="font-bold text-gray-900 dark:text-white leading-tight">{activeRoom ? (activeDM ? activeDM.name : activeRoom) : 'Select a Channel'}</h2><p className="text-xs text-gray-500 dark:text-gray-400">{activeRoom ? (activeDM ? 'Private Conversation' : currentGroup ? 'Private Group' : 'Public Channel') : 'Join the conversation'}</p></div>
             </div>
             <div className="flex items-center gap-2 text-gray-400">
                 {currentGroup && (<><button onClick={() => setIsViewingMembers(true)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400" title="View Members"><Info size={20} /></button><button onClick={() => setIsAddingMember(true)} className="p-2 bg-blue-50 text-blue-600 dark:bg-blue-600/10 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-600/20" title="Add Member"><UserPlus size={20} /></button></>)}
                 <button onClick={() => setShowMembers(!showMembers)} className={`p-2 rounded-lg transition-colors ${showMembers ? 'bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-white' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}><Users size={20} /></button>
             </div>
         </div>

         {/* MESSAGES AREA */}
         <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col px-4 pt-4 pb-4 bg-white dark:bg-[#0B0D0F]" ref={scrollRef} onScroll={handleScroll}>
             {isFetchingHistory && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-blue-500" size={24} /></div>}

             {!activeRoom ? (
                 <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                     <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center"><MessageCircle size={40} className="text-gray-400"/></div>
                     <div><h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Welcome to CapyChat</h3><p className="text-sm text-gray-500">Select a channel or start a conversation.</p></div>
                 </div>
             ) : isLoadingMessages && !isFetchingHistory ? <MessageSkeleton /> :
             <>
                 {messages.length === 0 && <div className="mt-auto mb-6 px-4"><div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4"><Hash size={32} className="text-blue-600 dark:text-blue-400" /></div><h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome to {activeDM ? activeDM.name : `#${activeRoom}`}!</h1><p className="text-gray-500 dark:text-gray-400">This is the start of the {activeDM ? 'conversation' : 'channel'}.</p></div>}
                 
                 {messages.map((msg, i) => (
                     <MessageBubble 
                        key={msg.id} msg={msg} prevMsg={messages[i-1]} user={user} 
                        isEditing={editingMessageId === msg.id}
                        editText={editText} setEditText={setEditText} setEditingMessageId={setEditingMessageId}
                        handleSaveEdit={handleSaveEdit} handleDeleteMessage={handleDeleteMessage}
                        openThread={openThread} toggleReaction={toggleReaction} handleOpenReaction={handleOpenReaction}
                        setLightboxImage={setLightboxImage}
                     />
                 ))}

                 {/* GHOST MESSAGE LOADER */}
                 {isSending && (
                     <div className="flex flex-col mt-4 animate-pulse px-2">
                         <div className="flex items-start gap-4">
                             <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-white/10 shrink-0" />
                             <div className="flex-1 space-y-2">
                                 <div className="flex items-center gap-2">
                                     <div className="h-4 w-20 bg-gray-200 dark:bg-white/10 rounded" />
                                     <div className="h-3 w-12 bg-gray-200 dark:bg-white/5 rounded" />
                                 </div>
                                 <div className="h-4 w-3/4 bg-gray-200 dark:bg-white/10 rounded" />
                                 <div className="h-4 w-1/2 bg-gray-200 dark:bg-white/10 rounded" />
                             </div>
                         </div>
                     </div>
                 )}
                 
                 {reactingToMessageId && (
                     <div 
                         ref={reactionPickerRef}
                         className="fixed z-50 shadow-2xl rounded-xl border border-gray-200 dark:border-white/10"
                         style={{ 
                             top: pickerPlacement === 'below' ? '50%' : 'auto', 
                             bottom: pickerPlacement === 'above' ? '50%' : 'auto',
                             left: '50%', transform: 'translate(-50%, -50%)' 
                         }}
                     >
                         <EmojiPicker onEmojiClick={handleEmojiClick} theme={Theme.AUTO} />
                     </div>
                 )}
                 <div className="h-2" />
             </>
             }
         </div>

         {/* INPUT AREA */}
         <div className="px-6 pb-6 bg-white dark:bg-[#0B0D0F] pt-2 relative">
             {typingUsers.size > 0 && <div className="absolute top-[-25px] left-6 flex items-center gap-2 text-xs font-bold text-gray-500 animate-pulse"><span className="flex items-center gap-1"><MoreHorizontal size={14} className="animate-bounce" /> {Array.from(typingUsers).slice(0, 3).join(', ')} is typing...</span></div>}
             <div className="relative">
                 {activeRoom ? <ChatInput onSendMessage={sendMessage} onTyping={sendTyping} isLoading={isSending} mentionCandidates={onlineUsers.map(u => ({ id: u.userId, name: u.name, avatar: u.avatar }))} /> : <div className="h-[60px] bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-300 dark:border-white/10 flex items-center justify-center text-sm text-gray-400">Join a channel to start chatting</div>}
             </div>
         </div>

         {/* LIGHTBOX & MODALS */}
         {lightboxImage && <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setLightboxImage(null)}><button className="absolute top-4 right-4 text-white/70 hover:text-white p-2"><X size={32} /></button><img src={lightboxImage} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl scale-100 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()} /></div>}
         
         {isViewingMembers && currentGroup && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"><div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-white/5"><h3 className="text-lg font-bold text-gray-900 dark:text-white">Group Members</h3><button onClick={() => setIsViewingMembers(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg"><X size={20} className="text-gray-500" /></button></div><div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">{currentGroup.members && currentGroup.members.map(member => (<div key={member.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors group"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold">{member.name.charAt(0)}</div><div className="flex-1"><div className="font-semibold text-gray-900 dark:text-white">{member.name}</div><div className="text-xs text-gray-500 dark:text-gray-400">{onlineUsers.some(o => o.userId === member.id) ? <span className="text-green-500 font-medium">● Online</span> : 'Offline'}</div></div>{member.id !== user.id && (<button onClick={() => setMemberToKick(member)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" title="Kick Member"><UserMinus size={16} /></button>)}</div>))}</div></div></div>}
         
         {memberToKick && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm bg-white dark:bg-[#1A1D21] border border-red-200 dark:border-red-900/50 rounded-xl shadow-2xl p-6 animate-in fade-in zoom-in-95"><div className="flex flex-col items-center text-center mb-6"><div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 mb-4"><AlertTriangle size={24} /></div><h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Remove Member?</h3><p className="text-sm text-gray-500 dark:text-gray-400">Remove <span className="font-bold text-gray-800 dark:text-gray-200">{memberToKick.name}</span>?</p></div><div className="flex gap-3"><button onClick={() => setMemberToKick(null)} className="flex-1 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white rounded-lg">Cancel</button><button onClick={handleKickAction} className="flex-1 py-2 bg-red-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-red-700 transition-colors">Remove</button></div></div></div>}
         
         {channelToDeleteId && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                 <div className="w-full max-w-sm bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl p-6 animate-in zoom-in-95">
                     <div className="flex flex-col items-center text-center mb-6">
                         <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 mb-4"><Trash2 size={24} /></div>
                         <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Channel?</h3>
                         <p className="text-sm text-gray-500 dark:text-gray-400">Are you sure you want to delete this channel?</p>
                     </div>
                     <div className="flex gap-3">
                         <button onClick={() => setChannelToDeleteId(null)} disabled={isDeletingLoading} className="flex-1 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-white/20">Cancel</button>
                         <button onClick={confirmDeleteChannel} disabled={isDeletingLoading} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                             {isDeletingLoading ? <Loader2 size={18} className="animate-spin" /> : 'Delete Channel'}
                         </button>
                     </div>
                 </div>
             </div>
         )}

         {messageToDelete && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl p-6 animate-in zoom-in-95"><div className="flex flex-col items-center text-center mb-6"><div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 mb-4"><Trash2 size={24} /></div><h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Message</h3><p className="text-sm text-gray-500 dark:text-gray-400">Are you sure? This action cannot be undone.</p></div><div className="flex gap-3"><button onClick={() => setMessageToDelete(null)} className="flex-1 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-white/20">Cancel</button><button onClick={confirmDeleteMessage} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Delete</button></div></div></div>}

         {isAddingMember && currentGroup && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"><div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-white/5"><h3 className="text-lg font-bold text-gray-900 dark:text-white">Add People</h3><button onClick={() => setIsAddingMember(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg"><X size={20} className="text-gray-500" /></button></div><div className="p-4 pb-0"><div className="relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={18} /><input autoFocus type="text" placeholder="Search users..." className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-900 dark:text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div><div className="max-h-[50vh] overflow-y-auto p-2 mt-2 custom-scrollbar">{allUsers.filter(u => u.id !== user.id && !currentGroup.members?.some(m => m.id === u.id) && u.name.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (<div key={u.id} onClick={() => handleAddMemberAction(u.id)} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors group"><div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold">{u.name.charAt(0)}</div><div className="flex-1"><div className="font-semibold text-gray-900 dark:text-white">{u.name}</div><div className="text-xs text-gray-500 dark:text-gray-400">{onlineUsers.some(o => o.userId === u.id) ? 'Online' : 'Offline'}</div></div>{addingMemberId === u.id ? <div className="p-2 text-blue-600"><Loader2 size={16} className="animate-spin" /></div> : <div className="p-2 bg-blue-50 dark:bg-blue-600/20 text-blue-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={16} /></div>}</div>))}</div></div></div>}
      </div>

      {/* 3. RIGHT SIDEBAR */}
      {activeThread && (
          <div className="w-80 bg-white dark:bg-[#15171B] flex flex-col border-l border-gray-200 dark:border-white/5 shadow-xl z-20">
              <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#1E1F22]">
                  <div className="flex items-center gap-2"><span className="font-bold text-gray-900 dark:text-white">Thread</span><span className="text-xs text-gray-500">#{activeRoom}</span></div>
                  <button onClick={closeThread} className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {parentMessage && <MessageBubble msg={parentMessage} user={user} isEditing={false} />}
                  {activeThread.replies.map(reply => (
                      <div key={reply.id} className="flex gap-3 mb-4 group"><div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-white/10 flex-shrink-0 flex items-center justify-center font-bold text-xs">{reply.user.avatar ? <img src={reply.user.avatar} className="w-full h-full object-cover rounded-lg"/> : reply.user.name.charAt(0)}</div><div><div className="flex items-baseline gap-2"><span className="font-bold text-sm text-gray-900 dark:text-white">{reply.user.name}</span><span className="text-[10px] text-gray-500">{formatTime(reply.createdAt)}</span></div><div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{renderMessageContent(reply.content)}</div></div></div>
                  ))}
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#1E1F22]">
                  <ChatInput onSendMessage={(content, file) => sendThreadMessage(content, activeThread.id, file)} isLoading={false} />
              </div>
          </div>
      )}
      
      {/* 4. MEMBER LIST (Standard) */}
      {!activeThread && showMembers && (
          <div className="w-64 bg-white dark:bg-[#15171B] hidden lg:flex flex-col border-l border-gray-200 dark:border-white/5 p-4 overflow-y-auto">
                {onlineMembersList.length > 0 && <div className="mb-6"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Online — {onlineMembersList.length}</h3>{onlineMembersList.map((u) => (<div key={u.id} onClick={() => startDM(u)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors group"><div className="relative"><div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden">{u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : u.name.charAt(0)}</div><div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div></div><div className="min-w-0"><div className="font-bold text-gray-900 dark:text-white text-sm truncate">{u.name}</div>{u.id === user?.id && <div className="text-xs text-blue-600 font-medium">You</div>}</div></div>))}</div>}
                {offlineMembersList.length > 0 && <div><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Offline — {offlineMembersList.length}</h3>{offlineMembersList.map((u) => (<div key={u.id} onClick={() => startDM(u)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors group opacity-60 hover:opacity-100"><div className="relative"><div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden">{u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : u.name.charAt(0)}</div></div><div className="min-w-0"><div className="font-bold text-gray-900 dark:text-white text-sm truncate">{u.name}</div>{u.id === user?.id && <div className="text-xs text-blue-600 font-medium">You</div>}</div></div>))}</div>}
          </div>
      )}
    </div>
  );
};

export default Chat;