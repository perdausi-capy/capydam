import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import { 
  MessageSquare, Bug, Lightbulb, CheckCircle, 
  Clock, Trash2, Mail, User, Search, Loader2, X, Send,
  CornerDownRight, Filter, Paperclip, ExternalLink
} from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal'; // ✅ Added Modal

// --- TYPES ---
type FeedbackType = 'general' | 'bug' | 'feature';
type FeedbackStatus = 'new' | 'read' | 'resolved';

interface FeedbackItem {
  id: string;
  type: FeedbackType;
  subject: string;
  message: string;
  user: { // Updated to match new backend response structure
    name: string | null;
    email: string;
    avatar: string | null;
  };
  createdAt: string;
  status: FeedbackStatus;
  adminReply?: string;
  repliedAt?: string;
  attachment?: string; // ✅ Attachment Support
}

const AdminFeedback = () => {
  const queryClient = useQueryClient();
  
  const [filter, setFilter] = useState<'all' | 'new' | 'resolved'>('all');
  const [search, setSearch] = useState('');

  // Reply Modal State
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  
  // Delete State
  const [itemToDelete, setItemToDelete] = useState<FeedbackItem | null>(null);

  // --- 1. FETCH DATA ---
  const { data: feedbacks, isLoading } = useQuery<FeedbackItem[]>({
    queryKey: ['admin-feedback'],
    queryFn: async () => {
      const { data } = await client.get('/feedback');
      return data;
    },
    staleTime: 1000 * 30, // 30s cache
  });

  // --- ACTIONS ---
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
        await client.delete(`/feedback/${id}`);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-feedback'] });
        setItemToDelete(null);
        toast.success('Feedback deleted');
    },
    onError: () => toast.error("Failed to delete")
  });

  const handleMarkAsRead = async (id: string) => {
    try {
        await client.patch(`/feedback/${id}/status`, { status: 'read' }); // Updated route
        queryClient.invalidateQueries({ queryKey: ['admin-feedback'] });
    } catch (e) { toast.error("Failed to update"); }
  };

  const openReplyModal = (item: FeedbackItem) => {
    setSelectedFeedback(item);
    setReplyMessage(item.adminReply || ''); // Pre-fill if editing
    setReplyModalOpen(true);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeedback || !replyMessage.trim()) return;
    
    setSendingReply(true);
    try {
        await client.post(`/feedback/${selectedFeedback.id}/reply`, {
            message: replyMessage
        });
        
        toast.success(`Reply sent!`);
        setReplyModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['admin-feedback'] });
    } catch (error) {
        toast.error("Failed to send reply");
    } finally {
        setSendingReply(false);
    }
  };

  // --- HELPERS ---
  const filteredData = feedbacks?.filter(item => {
    const matchesFilter = filter === 'all' || item.status === filter;
    
    const matchesSearch = item.subject.toLowerCase().includes(search.toLowerCase()) || 
                          item.user.email.toLowerCase().includes(search.toLowerCase()) ||
                          (item.user.name && item.user.name.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  }) || [];

  const getTypeIcon = (type: FeedbackType) => {
    switch (type) {
      case 'bug': return <Bug size={18} />;
      case 'feature': return <Lightbulb size={18} />;
      default: return <MessageSquare size={18} />;
    }
  };

  const getTypeColor = (type: FeedbackType) => {
      if (type === 'bug') return 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
      if (type === 'feature') return 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
      return 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F8F9FC] dark:bg-[#0B0D0F]"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] p-6 lg:p-10 transition-colors duration-500 relative overflow-hidden font-sans">
      
      {/* 🌟 Ambient Background Effects */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-400/10 dark:bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-400/10 dark:bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 text-gray-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:via-gray-200 dark:to-gray-500">
                    User Feedback
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                    Manage support tickets, track bugs, and reply to users.
                </p>
            </div>
            
            {/* Control Bar */}
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10 p-2 rounded-2xl flex flex-col sm:flex-row items-center gap-3 shadow-sm dark:shadow-none w-full md:w-auto">
                <div className="relative w-full sm:w-64">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Search tickets..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white/50 dark:bg-[#0B0D0F]/50 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
                    />
                </div>
                
                <div className="flex bg-gray-100 dark:bg-[#0B0D0F]/50 p-1 rounded-xl w-full sm:w-auto border border-gray-200 dark:border-white/10">
                    {(['all', 'new', 'resolved'] as const).map((f) => (
                        <button 
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-bold rounded-lg transition-all capitalize ${
                                filter === f 
                                ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* --- FEEDBACK LIST --- */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredData.length === 0 ? (
                <div className="text-center py-24 bg-white/50 dark:bg-white/5 border border-dashed border-gray-300 dark:border-white/10 rounded-3xl backdrop-blur-sm">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-500">
                        <Filter size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No tickets found</h3>
                    <p className="text-gray-500 dark:text-gray-400">Try adjusting your filters or search query.</p>
                </div>
            ) : (
                filteredData.map((item) => (
                    <div 
                        key={item.id} 
                        className={`group bg-white dark:bg-[#121418] rounded-2xl border transition-all hover:shadow-lg dark:hover:shadow-blue-900/10 relative overflow-hidden
                            ${item.status === 'new' 
                                ? 'border-l-4 border-l-blue-500 border-gray-100 dark:border-white/10' 
                                : 'border-gray-100 dark:border-white/5 opacity-95'
                            }`}
                    >
                        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                            
                            {/* LEFT: Icon */}
                            <div className="md:col-span-1 flex flex-col items-center gap-3">
                                <div className={`p-3 rounded-2xl border ${getTypeColor(item.type)}`}>
                                    {getTypeIcon(item.type)}
                                </div>
                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{item.type}</span>
                            </div>

                            {/* MIDDLE: Content */}
                            <div className="md:col-span-8 space-y-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <h3 className={`text-xl font-bold text-gray-900 dark:text-white ${item.status === 'read' ? 'font-medium' : ''}`}>
                                        {item.subject}
                                    </h3>
                                    {item.status === 'new' && (
                                        <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">New</span>
                                    )}
                                    {item.status === 'resolved' && (
                                        <span className="bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-300 border border-green-200 dark:border-green-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Resolved</span>
                                    )}
                                </div>
                                
                                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                    {item.message}
                                </p>

                                {/* ✅ EVIDENCE LINK */}
                                {item.attachment && (
                                    <div className="mt-2">
                                        <a href={item.attachment} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                            <Paperclip size={12} /> View Evidence <ExternalLink size={10} />
                                        </a>
                                    </div>
                                )}
                                
                                {/* ADMIN REPLY BOX */}
                                {item.adminReply && (
                                    <div className="mt-4 pl-4 border-l-2 border-blue-500/30">
                                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">
                                            <CornerDownRight size={12} />
                                            You replied on {new Date(item.repliedAt!).toLocaleDateString()}
                                        </div>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 italic bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                                            "{item.adminReply}"
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center gap-6 pt-2 text-xs text-gray-400 font-medium">
                                    <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-white/5 px-2 py-1 rounded-md">
                                        <User size={12} /> {item.user.name || 'Unknown'} <span className="opacity-50">({item.user.email})</span>
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Clock size={12} /> {new Date(item.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            {/* RIGHT: Actions */}
                            <div className="md:col-span-3 flex md:flex-col items-center md:items-end gap-2 h-full justify-start mt-4 md:mt-0">
                                {item.status === 'new' && (
                                    <button 
                                        onClick={() => handleMarkAsRead(item.id)} 
                                        className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                                    >
                                        <CheckCircle size={14} /> Mark Read
                                    </button>
                                )}
                                
                                <button 
                                    onClick={() => openReplyModal(item)}
                                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                                >
                                    <Mail size={14} /> {item.adminReply ? 'Update Reply' : 'Reply'}
                                </button>

                                <button 
                                    onClick={() => setItemToDelete(item)} 
                                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-900/30 transition-colors md:mt-auto"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>

                        </div>
                    </div>
                ))
            )}
        </div>

        {/* ✅ GLASS REPLY MODAL */}
        {replyModalOpen && selectedFeedback && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-[#121418] rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden transform transition-all scale-100">
                    
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Mail size={18} className="text-blue-500" /> 
                            Reply to {selectedFeedback.user.name}
                        </h3>
                        <button onClick={() => setReplyModalOpen(false)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-4">
                        <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 text-xs font-bold uppercase text-gray-400">
                                    <MessageSquare size={12} /> User Said:
                                </div>
                                {/* ✅ Evidence Quick Link in Modal */}
                                {selectedFeedback.attachment && (
                                    <a href={selectedFeedback.attachment} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                        <Paperclip size={10} /> Evidence
                                    </a>
                                )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{selectedFeedback.message}"</p>
                        </div>

                        <form onSubmit={handleSendReply}>
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Your Response</label>
                                <textarea 
                                    autoFocus
                                    rows={6}
                                    className="w-full bg-white dark:bg-[#0B0D0F] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white resize-none placeholder:text-gray-400"
                                    placeholder="Type your reply here..."
                                    value={replyMessage}
                                    onChange={e => setReplyMessage(e.target.value)}
                                />
                            </div>
                            
                            <div className="flex justify-end gap-3 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setReplyModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-white/5"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={!replyMessage.trim() || sendingReply}
                                    className="px-6 py-2.5 rounded-xl bg-gray-900 dark:bg-blue-600 hover:bg-gray-800 dark:hover:bg-blue-500 text-white text-sm font-bold shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {sendingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    Send Reply
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        )}

        {/* ✅ CONFIRM DELETE MODAL */}
        <ConfirmModal 
            isOpen={!!itemToDelete}
            onClose={() => setItemToDelete(null)}
            onConfirm={() => itemToDelete && deleteMutation.mutate(itemToDelete.id)}
            title="Delete Feedback"
            message="Are you sure you want to delete this ticket? This cannot be undone."
            confirmText="Delete"
            isDangerous
        />

      </div>
    </div>
  );
};

export default AdminFeedback;