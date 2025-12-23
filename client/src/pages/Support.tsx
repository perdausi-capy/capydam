import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Bug, Lightbulb, 
  Send, CheckCircle, History, User, 
  Clock, Sparkles, Trash2, Loader2, 
  FileText, ArrowRight, Paperclip, X, UploadCloud, Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { toast } from 'react-toastify';

// --- TYPES ---
type FeedbackType = 'general' | 'bug' | 'feature';

interface FeedbackItem {
  id: string;
  type: FeedbackType;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'resolved';
  createdAt: string;
  adminReply?: string;
  repliedAt?: string;
  attachment?: string; // ✅ Added to show evidence in history if needed
}

const Support = () => {
  const { user } = useAuth();
  
  // State
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    type: 'general' as FeedbackType,
    subject: '',
    message: ''
  });

  // ✅ Attachment State
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History State
  const [myFeedbacks, setMyFeedbacks] = useState<FeedbackItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // --- FETCH HISTORY ---
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
        const { data } = await client.get('/feedback/my');
        setMyFeedbacks(data);
    } catch (err) {
        console.error("Failed to load history");
    } finally {
        setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
        fetchHistory();
    } else {
        client.get('/feedback/my').then(res => setMyFeedbacks(res.data)).catch(() => {});
    }
  }, [activeTab]);

  // --- ACTIONS ---

  // ✅ Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        // Optional: Limit size to 5MB
        if (file.size > 5 * 1024 * 1024) {
            toast.warning("File is too large. Max 5MB.");
            return;
        }
        setAttachment(file);
    }
  };

  const handleRemoveFile = () => {
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.message.trim()) {
        toast.warning("Please fill in all fields");
        return;
    }

    setLoading(true);
    try {
      // ✅ Use FormData for File Upload
      const payload = new FormData();
      payload.append('type', formData.type);
      payload.append('subject', formData.subject);
      payload.append('message', formData.message);
      
      if (attachment) {
          payload.append('attachment', attachment);
      }

      await client.post('/feedback', payload, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess(true);
      toast.success("Feedback sent!");
      
      // Reset Form
      setFormData({ type: 'general', subject: '', message: '' }); 
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      client.get('/feedback/my').then(res => setMyFeedbacks(res.data));
    } catch (error) {
      toast.error("Failed to send feedback.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!window.confirm("Delete this ticket history?")) return;

    try {
        await client.delete(`/feedback/my/${id}`);
        setMyFeedbacks(prev => prev.filter(item => item.id !== id));
        toast.success("Ticket deleted");
    } catch (error) {
        toast.error("Failed to delete ticket");
    }
  };

  // --- HELPERS ---
  const replyCount = myFeedbacks.filter(f => f.adminReply).length;

  const getTypeColor = (type: FeedbackType, active: boolean) => {
      if (type === 'bug') {
          return active 
            ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500 dark:text-red-500' 
            : 'hover:border-red-200 hover:bg-red-50/50 dark:hover:border-red-500/50 dark:hover:text-red-500';
      }
      if (type === 'feature') {
          return active 
            ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500 dark:text-amber-500' 
            : 'hover:border-amber-200 hover:bg-amber-50/50 dark:hover:border-amber-500/50 dark:hover:text-amber-500';
      }
      return active 
        ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500 dark:text-blue-500' 
        : 'hover:border-blue-200 hover:bg-blue-50/50 dark:hover:border-blue-500/50 dark:hover:text-blue-500';
  };

  // --- RENDER ---
  if (success && activeTab === 'form') {
    return (
        <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] text-gray-900 dark:text-white flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-green-400/10 dark:bg-green-500/20 blur-[100px] rounded-full pointer-events-none" />
            
            <div className="bg-white/80 dark:bg-white/5 backdrop-blur-2xl border border-gray-100 dark:border-white/10 p-12 rounded-3xl shadow-2xl dark:shadow-none text-center max-w-md w-full relative z-10 animate-in zoom-in-95 duration-300">
                <div className="h-20 w-20 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm dark:shadow-[0_0_30px_rgba(74,222,128,0.2)]">
                    <CheckCircle size={40} />
                </div>
                <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Message Sent!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8">
                    Thanks for helping us improve. Check your history for updates.
                </p>
                <div className="space-y-3">
                    <button 
                        onClick={() => setActiveTab('history')}
                        className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-gradient-to-r dark:from-blue-600 dark:to-indigo-600 text-white font-bold hover:opacity-90 transition-all shadow-lg shadow-gray-200/50 dark:shadow-blue-500/20"
                    >
                        View My Tickets
                    </button>
                    <button 
                        onClick={() => setSuccess(false)}
                        className="w-full py-3.5 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                    >
                        Send Another
                    </button>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] text-gray-900 dark:text-white p-6 lg:p-12 transition-colors duration-500 relative overflow-hidden font-sans">
      
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-400/10 dark:bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-400/10 dark:bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
                <h1 className="text-5xl font-extrabold tracking-tight mb-3 text-gray-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:via-gray-200 dark:to-gray-500">
                    Help Center
                </h1>
                <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl">
                    Found a bug? Have a brilliant idea? We're listening.
                </p>
            </div>

            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10 p-1.5 rounded-2xl flex items-center shadow-sm dark:shadow-none">
                <button 
                    onClick={() => setActiveTab('form')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'form' 
                        ? 'bg-gray-900 text-white dark:bg-gradient-to-r dark:from-blue-600 dark:to-indigo-600 shadow-md' 
                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'
                    }`}
                >
                    <Send size={16} /> Contact
                </button>
                
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`relative px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'history' 
                        ? 'bg-gray-900 text-white dark:bg-gradient-to-r dark:from-blue-600 dark:to-indigo-600 shadow-md' 
                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'
                    }`}
                >
                    <History size={16} /> My Tickets
                    {replyCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#0B0D0F]">
                            {replyCount}
                        </span>
                    )}
                </button>
            </div>
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            
            {/* TAB 1: FORM */}
            {activeTab === 'form' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                    
                    {/* Left Column: Info Cards */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Reply Status Card */}
                        <div className="group relative overflow-hidden rounded-3xl p-[1px] shadow-lg shadow-blue-500/5">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-500/20 dark:to-purple-500/20 opacity-100 dark:opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative bg-white/90 dark:bg-[#121418] rounded-[23px] p-6 border border-white/40 dark:border-white/5 h-full backdrop-blur-sm">
                                <div className="h-10 w-10 bg-blue-100 dark:bg-gradient-to-br dark:from-blue-500 dark:to-indigo-600 rounded-xl flex items-center justify-center mb-4 text-blue-600 dark:text-white shadow-sm">
                                    <Sparkles size={20} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Check Updates</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                                    You have <span className="text-gray-900 dark:text-white font-bold">{replyCount}</span> tickets with new responses from our team.
                                </p>
                                <button 
                                    onClick={() => setActiveTab('history')} 
                                    className="text-sm font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-500 dark:group-hover:text-blue-300 flex items-center gap-1 transition-colors"
                                >
                                    Go to History <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Documentation Card */}
                        <div className="bg-white/60 dark:bg-[#121418] border border-gray-100 dark:border-white/5 rounded-3xl p-6 hover:border-gray-200 dark:hover:border-white/10 transition-colors shadow-sm">
                            <div className="flex items-center gap-4 mb-3">
                                <div className="p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-600 dark:text-gray-300">
                                    <FileText size={20} />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white">Documentation</h3>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Need help setting up? Check our detailed guides and FAQs.
                            </p>
                        </div>
                    </div>

                    {/* Right Column: The Form */}
                    <div className="lg:col-span-8">
                        <div className="bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 p-8 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none relative">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 dark:bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />

                            <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                                
                                {/* Type Selectors */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Feedback Type</label>
                                    <div className="grid grid-cols-3 gap-4">
                                        {[
                                            { id: 'general', icon: MessageSquare, label: 'General' },
                                            { id: 'bug', icon: Bug, label: 'Bug Report' },
                                            { id: 'feature', icon: Lightbulb, label: 'Feature Idea' },
                                        ].map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, type: item.id as FeedbackType })}
                                                className={`
                                                    flex flex-col items-center justify-center gap-3 py-6 rounded-2xl border transition-all duration-300
                                                    bg-white/50 dark:bg-[#0B0D0F]/50 backdrop-blur-sm
                                                    ${getTypeColor(item.id as FeedbackType, formData.type === item.id)}
                                                `}
                                            >
                                                <item.icon size={24} strokeWidth={1.5} />
                                                <span className="text-xs font-bold tracking-wide">{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Inputs */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Subject</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-white dark:bg-[#0B0D0F]/50 border border-gray-200 dark:border-white/10 rounded-xl px-5 py-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 shadow-sm dark:shadow-none"
                                            placeholder="What is this about?"
                                            value={formData.subject}
                                            onChange={e => setFormData({...formData, subject: e.target.value})}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Message</label>
                                        <textarea 
                                            rows={6}
                                            className="w-full bg-white dark:bg-[#0B0D0F]/50 border border-gray-200 dark:border-white/10 rounded-xl px-5 py-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white transition-all resize-none placeholder:text-gray-400 dark:placeholder:text-gray-600 leading-relaxed shadow-sm dark:shadow-none"
                                            placeholder="Describe your issue or idea in detail..."
                                            value={formData.message}
                                            onChange={e => setFormData({...formData, message: e.target.value})}
                                        />
                                    </div>

                                    {/* ✅ ATTACHMENT INPUT */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Attachment (Optional)</label>
                                        
                                        {!attachment ? (
                                            <div 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer group"
                                            >
                                                <div className="p-3 bg-gray-100 dark:bg-white/5 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                                    <UploadCloud size={24} className="text-gray-500 dark:text-gray-400 group-hover:text-blue-500" />
                                                </div>
                                                <p className="text-sm font-medium">Click to upload screenshot or evidence</p>
                                                <p className="text-xs mt-1 opacity-70">JPG, PNG, PDF allowed (Max 5MB)</p>
                                            </div>
                                        ) : (
                                            <div className="w-full bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                                        {attachment.type.includes('image') ? <ImageIcon size={20}/> : <Paperclip size={20}/>}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{attachment.name}</p>
                                                        <p className="text-xs text-gray-500">{(attachment.size / 1024).toFixed(1)} KB</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={handleRemoveFile}
                                                    className="p-2 hover:bg-red-100 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        )}
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,.pdf" />
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button 
                                    type="submit" 
                                    disabled={loading}
                                    className="w-full py-4 rounded-xl bg-gray-900 dark:bg-gradient-to-r dark:from-blue-600 dark:to-indigo-600 text-white font-bold text-lg shadow-xl shadow-gray-200/50 dark:shadow-blue-500/20 hover:opacity-90 dark:hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <><Send size={20} /> Send Feedback</>}
                                </button>
                                
                                <p className="text-center text-xs text-gray-500 dark:text-gray-600">
                                    Submitting as <span className="font-bold text-gray-800 dark:text-gray-400">{user?.email}</span>
                                </p>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: HISTORY */}
            {activeTab === 'history' && (
                <div className="max-w-3xl mx-auto space-y-6">
                    {loadingHistory ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>
                    ) : myFeedbacks.length === 0 ? (
                        <div className="text-center py-24 bg-white/50 dark:bg-white/5 border border-dashed border-gray-300 dark:border-white/10 rounded-3xl backdrop-blur-sm">
                            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400 dark:text-gray-500">
                                <History size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No tickets yet</h3>
                            <p className="text-gray-500 mb-6">Your conversation history will appear here.</p>
                            <button onClick={() => setActiveTab('form')} className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                                Create a ticket &rarr;
                            </button>
                        </div>
                    ) : (
                        myFeedbacks.map((item) => (
                            <div key={item.id} className="group bg-white dark:bg-[#121418] border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden hover:border-gray-200 dark:hover:border-white/10 transition-all shadow-sm hover:shadow-md dark:shadow-lg relative">
                                
                                <div className="p-6 border-b border-gray-50 dark:border-white/5 flex justify-between items-start bg-gray-50/50 dark:bg-white/[0.02]">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${
                                            item.status === 'resolved' 
                                            ? 'bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400' 
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700/30 dark:text-gray-400'
                                        }`}>
                                            {item.status === 'resolved' ? <CheckCircle size={20} /> : <Clock size={20} />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white text-lg">{item.subject}</h3>
                                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                                                <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></span>
                                                <span className="uppercase tracking-wider font-bold text-gray-400">{item.type}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col items-end gap-3">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                            item.status === 'resolved' 
                                            ? 'bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20' 
                                            : item.adminReply 
                                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20' 
                                                : 'bg-gray-100 text-gray-500 dark:bg-gray-500/10 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20'
                                        }`}>
                                            {item.status === 'resolved' ? 'Resolved' : item.adminReply ? 'Reply Received' : 'Pending'}
                                        </span>

                                        <button 
                                            onClick={(e) => handleDelete(item.id, e)}
                                            className="text-gray-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-500 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100"
                                            title="Delete ticket"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-6">
                                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                        {item.message}
                                    </p>
                                    
                                    {/* ✅ SHOW ATTACHMENT LINK IF EXISTS */}
                                    {item.attachment && (
                                        <div className="mt-4">
                                            <a 
                                                href={item.attachment} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-white/5 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                            >
                                                <Paperclip size={16} /> View Attachment
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {item.adminReply && (
                                    <div className="bg-blue-50/50 dark:bg-transparent dark:bg-gradient-to-b dark:from-blue-500/5 dark:to-transparent border-t border-blue-100 dark:border-blue-500/10 p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0">
                                                <User size={16} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">Support Team</h4>
                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                                        {item.repliedAt ? new Date(item.repliedAt).toLocaleDateString() : 'Just now'}
                                                    </span>
                                                </div>
                                                <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed p-4 bg-white dark:bg-[#0B0D0F] rounded-xl border border-blue-100 dark:border-white/5 shadow-sm dark:shadow-inner">
                                                    {item.adminReply}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default Support;