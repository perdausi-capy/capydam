import React, { useState, useMemo, createContext, useContext, useEffect } from 'react';
import { Search, X, Copy, Heart, Code, Check, ExternalLink, PlayCircle, Loader2, RefreshCw, Edit2, Save, Trash2, AlertTriangle } from 'lucide-react';
import Masonry from 'react-masonry-css';
import DashboardHeaderJrd from '../components/DashboardHeaderJrd'; 
import { toast } from 'react-toastify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

// --- 1. TYPES ---
export interface GsapData {
  id: string; 
  title: string;
  description: string;
  documentationUrl?: string;
  codeSnippet: string;
  variables: string; 
  dataAccessibilityText?: string;
  embedVideo: string;
  image?: string;
  color?: string;
  likes: number;
  dateAdded: string;
  rowIndex: number; // ✅ WE WILL USE THIS FOR DELETING/EDITING
}

// --- 2. CONTEXT ---
interface GsapContextType {
  data: GsapData[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleLike: (index: number, currentLikes: number) => void;
  updateEntry: (index: number, data: any) => Promise<void>; // Changed id -> index
  deleteEntry: (index: number) => Promise<void>;            // Changed id -> index
  refetch: () => void;
}

const GsapContext = createContext<GsapContextType | undefined>(undefined);

// ⚠️ CHANGE THIS TO YOUR ACTUAL SERVER URL
const API_URL = 'https://dam.capy-dev.com/api/gsap-library'; 

const GsapProvider = ({ children }: { children: React.ReactNode }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // --- GET DATA ---
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gsap-library'],
    queryFn: async () => {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Failed to fetch data');
      const rawData = await res.json();
      return rawData.map((item: any, index: number) => ({
        ...item,
        id: item.id || '', 
        rowIndex: index, // This matches the array index from the sheet
        likes: parseInt(item.likes || '0', 10)
      }));
    },
    staleTime: 1000 * 60 * 5, 
  });

  // --- LIKE MUTATION ---
  const likeMutation = useMutation({
    mutationFn: async ({ index, likes }: { index: number; likes: number }) => {
      await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index, likes, action: 'like' }),
      });
    },
    onMutate: async ({ index, likes }) => {
      await queryClient.cancelQueries({ queryKey: ['gsap-library'] });
      const previousData = queryClient.getQueryData<GsapData[]>(['gsap-library']);
      queryClient.setQueryData(['gsap-library'], (old: GsapData[] | undefined) => {
        if (!old) return [];
        return old.map((item) => item.rowIndex === index ? { ...item, likes } : item);
      });
      return { previousData };
    },
    onError: (_err, _newTodo, context) => {
      if (context?.previousData) queryClient.setQueryData(['gsap-library'], context.previousData);
      toast.error("Failed to update like");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['gsap-library'] }),
  });

  // --- UPDATE MUTATION (EDIT BY INDEX) ---
  const updateMutation = useMutation({
    mutationFn: async ({ index, data }: { index: number; data: any }) => {
      const res = await fetch(API_URL, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // ✅ SEND INDEX, NOT ID
        body: JSON.stringify({ ...data, index, action: 'update' }), 
      });
      if (!res.ok) throw new Error('Failed to update');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gsap-library'] });
      toast.success("Entry updated successfully!");
    },
    onError: () => toast.error("Failed to update entry.")
  });

  // --- DELETE MUTATION (DELETE BY INDEX) ---
  const deleteMutation = useMutation({
    mutationFn: async (index: number) => {
      // ✅ SEND INDEX IN URL
      const res = await fetch(`${API_URL}?index=${index}&action=delete`, { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to delete');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gsap-library'] });
      toast.success("Entry deleted successfully");
    },
    onError: (error: any) => {
      console.error("Delete Error:", error);
      toast.error(error.message || "Failed to delete entry");
    }
  });

  const handleLike = (index: number, currentLikes: number) => {
    likeMutation.mutate({ index, likes: currentLikes + 1 });
  };

  const updateEntry = async (index: number, data: any) => {
    await updateMutation.mutateAsync({ index, data });
  };

  const deleteEntry = async (index: number) => {
    await deleteMutation.mutateAsync(index);
  };

  return (
    <GsapContext.Provider value={{ data: data || [], isLoading, searchQuery, setSearchQuery, handleLike, updateEntry, deleteEntry, refetch }}>
      {children}
    </GsapContext.Provider>
  );
};

const useGsap = () => {
  const context = useContext(GsapContext);
  if (!context) throw new Error('useGsap must be used within a GsapProvider');
  return context;
};

// --- HELPER FUNCTIONS ---
const getYoutubeId = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// --- 3. UI COMPONENTS ---

const SkeletonCard = () => (
  <div className="mb-6 w-full">
    <div className="w-full aspect-video bg-gray-200 dark:bg-white/5 rounded-2xl animate-pulse" />
    <div className="mt-3 space-y-2 px-1">
      <div className="h-4 bg-gray-200 dark:bg-white/5 rounded w-3/4 animate-pulse" />
    </div>
  </div>
);

const GsapCard = React.memo(({ item, onClick, onEdit, onDelete }: { item: GsapData; onClick: (item: GsapData) => void; onEdit: (item: GsapData) => void; onDelete: (item: GsapData) => void }) => {
  const { handleLike } = useGsap();
  const [copied, setCopied] = useState(false);
  const tags = useMemo(() => item.variables ? item.variables.split(',').map(s => s.trim()) : [], [item.variables]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.codeSnippet);
    setCopied(true);
    toast.success("Code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const renderMedia = () => {
    if (item.image) {
      return (
        <div className="relative w-full h-full">
          <img src={item.image} alt={item.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" />
          {item.embedVideo && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/40 rounded-full p-2 backdrop-blur-sm"><PlayCircle className="text-white w-6 h-6" /></div>
             </div>
          )}
        </div>
      );
    }
    if (item.embedVideo) {
      const youtubeId = getYoutubeId(item.embedVideo);
      if (youtubeId) {
        return (
          <div className="relative w-full h-full">
             <img src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`} alt={item.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" />
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm"><PlayCircle className="text-white w-8 h-8" fill="currentColor" /></div>
             </div>
          </div>
        );
      }
      return <video src={item.embedVideo} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" autoPlay muted loop playsInline />;
    }
    return <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-600"><Code size={40} /></div>;
  };

  return (
    <div className="group relative mb-6 block transition-all duration-300 w-full min-w-0 transform-gpu" onClick={() => onClick(item)}>
      <div className="relative w-full rounded-2xl overflow-hidden bg-gray-900 shadow-sm hover:shadow-xl active:scale-[0.98] transition-all cursor-pointer aspect-video group border border-transparent dark:border-white/5">
        {renderMedia()}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-2 right-2 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all pointer-events-none z-10">
            {item.documentationUrl && (
              <a href={item.documentationUrl} target="_blank" rel="noreferrer" className="pointer-events-auto bg-white/90 dark:bg-black/60 p-2 rounded-full text-gray-600 dark:text-gray-300 hover:text-blue-500 backdrop-blur-md shadow-sm transition-transform hover:scale-110" onClick={(e) => e.stopPropagation()}><ExternalLink size={14} /></a>
            )}
            <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="pointer-events-auto bg-white/90 dark:bg-black/60 p-2 rounded-full text-amber-500 hover:text-amber-600 backdrop-blur-md shadow-sm transition-transform hover:scale-110"><Edit2 size={14} /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(item); }} className="pointer-events-auto bg-white/90 dark:bg-black/60 p-2 rounded-full text-red-500 hover:text-red-600 backdrop-blur-md shadow-sm transition-transform hover:scale-110"><Trash2 size={14} /></button>
            <button onClick={handleCopy} className="pointer-events-auto bg-white/90 dark:bg-black/60 p-2 rounded-full text-indigo-500 dark:text-indigo-400 backdrop-blur-md shadow-sm transition-transform hover:scale-110">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
            <button onClick={(e) => { e.stopPropagation(); handleLike(item.rowIndex, item.likes); }} className="pointer-events-auto bg-white/90 dark:bg-black/60 p-2 rounded-full text-pink-500 flex items-center gap-1 backdrop-blur-md shadow-sm transition-transform hover:scale-110"><Heart size={14} className={item.likes > 0 ? "fill-current" : ""} /><span className="text-[10px] font-bold">{item.likes}</span></button>
        </div>
      </div>
      <div className="mt-3 px-1">
        <h3 className="truncate font-bold text-sm text-gray-800 dark:text-gray-100 leading-tight">{item.title || "Untitled"}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 opacity-90 md:opacity-80 md:group-hover:opacity-100 transition-opacity">
          {tags.slice(0, 3).map((tag, i) => (<span key={i} className="text-[10px] font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-500/20">{tag}</span>))}
        </div>
      </div>
    </div>
  );
});

// --- 4. DETAILS MODAL ---
const DetailsModal = ({ item, onClose }: { item: GsapData | null, onClose: () => void }) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCopied(false); }, [item]);
  if (!item) return null;
  const handleCopy = () => { navigator.clipboard.writeText(item.codeSnippet); setCopied(true); toast.success("Code copied!"); setTimeout(() => setCopied(false), 2000); };
  const renderModalMedia = () => {
    if (item.embedVideo) {
      const youtubeId = getYoutubeId(item.embedVideo);
      if (youtubeId) return <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`} title="YT" frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen className="w-full h-full" />;
      return <video src={item.embedVideo} controls className="w-full h-full object-contain bg-black" />;
    }
    return <img src={item.image || ''} alt="Preview" className="w-full h-full object-contain bg-black" />;
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-5xl bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] md:h-auto md:max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 dark:border-white/5 shrink-0 bg-white dark:bg-[#1A1D21]"><h3 className="font-bold text-base md:text-lg text-gray-900 dark:text-white truncate pr-4">{item.title}</h3><button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white"><X size={20} /></button></div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col md:flex-row gap-6 custom-scrollbar">
          <div className="w-full md:w-1/2 flex flex-col gap-5 shrink-0"><div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-gray-200 dark:border-white/10 shadow-lg">{renderModalMedia()}</div><div className="space-y-4"><p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{item.description}</p>{item.documentationUrl && (<a href={item.documentationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-xs font-bold uppercase tracking-wide bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg"><ExternalLink size={14} /> Documentation</a>)}<div className="flex flex-wrap gap-2 pt-2">{item.variables?.split(',').map((tag, i) => (<span key={i} className="text-[10px] font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded border border-gray-200 dark:border-white/5">#{tag.trim()}</span>))}</div></div></div>
          <div className="w-full md:w-1/2 flex flex-col min-h-[300px] md:h-full"><div className="flex justify-between items-center mb-3 shrink-0"><span className="text-xs font-bold uppercase tracking-wider text-gray-500">Code Snippet</span><button onClick={handleCopy} className={`text-xs flex items-center gap-1.5 font-medium px-3 py-1.5 rounded-md transition-all border ${copied ? 'bg-green-50 text-green-600 border-green-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy Code'}</button></div><div className="flex-1 bg-gray-50 dark:bg-[#0d0e10] rounded-xl border border-gray-200 dark:border-white/10 relative group overflow-hidden shadow-inner"><div className="absolute inset-0 p-4 overflow-auto custom-scrollbar"><pre className="font-mono text-xs md:text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap">{item.codeSnippet}</pre></div></div></div>
        </div>
      </motion.div>
    </div>
  );
};

// --- 5. MODALS ---
const AddNewDataModal = ({ isOpen, onClose, refetch }: { isOpen: boolean, onClose: () => void, refetch: () => void }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', codeSnippet: '', variables: '', dataAccessibilityText: '', documentationUrl: '', embedVideo: '', image: '' });

  if (!isOpen) return null;
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== 'bambampogi') { toast.error("Incorrect password!"); return; }
    setLoading(true);
    try {
      const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formData, likes: 0, dateAdded: new Date().toISOString() }), });
      if (!response.ok) throw new Error('Failed to add');
      toast.success("Entry added!");
      setFormData({ title: '', description: '', codeSnippet: '', variables: '', dataAccessibilityText: '', documentationUrl: '', embedVideo: '', image: '' });
      setPassword(''); refetch(); onClose();
    } catch (error) { toast.error("Failed to add entry."); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm bg-black/50"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0" onClick={onClose} /><motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"><div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-[#15171a]"><h2 className="text-lg font-bold text-gray-900 dark:text-white">Add New Entry</h2><button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500"><X size={20} /></button></div><div className="flex-1 overflow-y-auto p-6 custom-scrollbar"><form onSubmit={handleSubmit} className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input name="title" value={formData.title} onChange={handleChange} required className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Title" /><input name="documentationUrl" value={formData.documentationUrl} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Docs URL" /></div><textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Description" /><textarea name="codeSnippet" value={formData.codeSnippet} onChange={handleChange} rows={6} required className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-900 text-gray-300 font-mono text-xs" placeholder="Code..." /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input name="image" value={formData.image} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Image URL" /><input name="embedVideo" value={formData.embedVideo} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Video URL" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input name="variables" value={formData.variables} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Tags" /><input name="dataAccessibilityText" value={formData.dataAccessibilityText} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Alt Text" /></div><div className="pt-4 border-t border-gray-100 dark:border-white/5"><input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 dark:text-white text-sm" placeholder="Admin Password" /></div><button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />} {loading ? 'Saving...' : 'Save Entry'}</button></form></div></motion.div></div>
  );
};

const EditDataModal = ({ item, isOpen, onClose, refetch }: { item: GsapData | null, isOpen: boolean, onClose: () => void, refetch: () => void }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', codeSnippet: '', variables: '', dataAccessibilityText: '', documentationUrl: '', embedVideo: '', image: '' });

  React.useEffect(() => { if (item) setFormData({ title: item.title || '', description: item.description || '', codeSnippet: item.codeSnippet || '', variables: item.variables || '', dataAccessibilityText: item.dataAccessibilityText || '', documentationUrl: item.documentationUrl || '', embedVideo: item.embedVideo || '', image: item.image || '' }); }, [item]);
  if (!isOpen || !item) return null;
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== 'bambampogi') { toast.error("Incorrect password!"); return; }
    setLoading(true);
    try {
      // ✅ USING INDEX (item.rowIndex) because ID doesn't exist
      await fetch(API_URL, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formData, index: item.rowIndex, action: 'update' }) });
      toast.success("Entry updated!"); setPassword(''); refetch(); onClose();
    } catch (error) { console.error(error); toast.error("Failed to update."); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 backdrop-blur-sm bg-black/60"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0" onClick={onClose} /><motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"><div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20"><h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Edit2 size={18} /> Edit Entry</h2><button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full"><X size={20} /></button></div><div className="flex-1 overflow-y-auto p-6 custom-scrollbar"><form onSubmit={handleSubmit} className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input name="title" value={formData.title} onChange={handleChange} required className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Title" /><input name="documentationUrl" value={formData.documentationUrl} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Docs URL" /></div><textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Description" /><textarea name="codeSnippet" value={formData.codeSnippet} onChange={handleChange} rows={6} required className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-900 text-gray-300 font-mono text-xs" placeholder="Code..." /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input name="image" value={formData.image} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Image URL" /><input name="embedVideo" value={formData.embedVideo} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Video URL" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input name="variables" value={formData.variables} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Tags" /><input name="dataAccessibilityText" value={formData.dataAccessibilityText} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent dark:text-white text-sm" placeholder="Alt Text" /></div><div className="pt-4 border-t border-gray-100 dark:border-white/5"><input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-2 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 dark:text-white text-sm" placeholder="Admin Password" /></div><button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} {loading ? 'Updating...' : 'Save Changes'}</button></form></div></motion.div></div>
  );
};

const DeleteConfirmationModal = ({ item, isOpen, onClose, refetch }: { item: GsapData | null, isOpen: boolean, onClose: () => void, refetch: () => void }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !item) return null;

  const handleDelete = async () => {
    if (password !== 'bambampogi') { toast.error("Incorrect password!"); return; }
    setLoading(true);
    try {
      // ✅ USING INDEX (item.rowIndex) because ID doesn't exist
      await fetch(`${API_URL}?index=${item.rowIndex}&action=delete`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
      toast.success("Entry deleted!"); setPassword(''); refetch(); onClose();
    } catch (error) { console.error(error); toast.error("Failed to delete."); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 backdrop-blur-sm bg-black/60"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0" onClick={onClose} /><motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl p-6 border border-red-100 dark:border-red-900/20"><div className="flex flex-col items-center text-center gap-4"><div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full text-red-600 dark:text-red-500"><AlertTriangle size={32} /></div><h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete Entry?</h3><p className="text-sm text-gray-500 dark:text-gray-400">Are you sure you want to delete <strong>"{item.title}"</strong>? This action cannot be undone.</p><div className="w-full mt-2"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 dark:text-white text-center text-sm focus:ring-2 focus:ring-red-500 outline-none" placeholder="Enter Admin Password" /></div><div className="flex gap-3 w-full mt-2"><button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">Cancel</button><button onClick={handleDelete} disabled={loading} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />} {loading ? 'Deleting...' : 'Delete'}</button></div></div></motion.div></div>
  );
};

// --- 6. MAIN LAYOUT ---
const JrdAssetsContent = () => {
  const { data, isLoading, searchQuery, setSearchQuery, refetch } = useGsap();
  const [selectedItem, setSelectedItem] = useState<GsapData | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GsapData | null>(null);
  const [deletingItem, setDeletingItem] = useState<GsapData | null>(null);

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const lowerQ = searchQuery.toLowerCase();
    return data.filter(item => item.title?.toLowerCase().includes(lowerQ) || item.description?.toLowerCase().includes(lowerQ) || item.variables?.toLowerCase().includes(lowerQ));
  }, [data, searchQuery]);
  const breakpointColumnsObj = { default: 5, 1600: 4, 1280: 3, 1024: 2, 640: 1 };

  return (
    <div className="min-h-screen pb-20 bg-[#F3F4F6] dark:bg-[#0B0D0F] transition-colors duration-500">
      <DashboardHeaderJrd assetsCount={filteredData.length} searchQuery={searchQuery} setSearchQuery={setSearchQuery} filterType="all" setFilterType={() => {}} onAddAsset={() => setIsAddModalOpen(true)} />
      <div className="px-4 md:px-8 mt-6 max-w-[2400px] mx-auto w-full">{isLoading ? (<Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-4 md:-ml-6" columnClassName="pl-4 md:pl-6 bg-clip-padding">{Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}</Masonry>) : filteredData.length === 0 ? (<div className="flex flex-col items-center justify-center p-10 md:p-20 mt-10 opacity-60"><div className="bg-gray-200 dark:bg-gray-800 p-6 rounded-full mb-4"><Search size={48} className="text-gray-400" /></div><p className="text-gray-500 text-lg font-medium">No matching assets found.</p><button onClick={() => setSearchQuery('')} className="mt-4 flex items-center gap-2 text-blue-500 hover:text-blue-600 font-medium"><RefreshCw size={16} /> Clear Search</button></div>) : (<Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-4 md:-ml-6" columnClassName="pl-4 md:pl-6 bg-clip-padding">{filteredData.map((item) => (<GsapCard key={item.id || item.rowIndex} item={item} onClick={setSelectedItem} onEdit={setEditingItem} onDelete={setDeletingItem} />))}</Masonry>)}</div>
      <AnimatePresence>
        {selectedItem && <DetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
        {isAddModalOpen && <AddNewDataModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} refetch={refetch} />}
        {editingItem && <EditDataModal item={editingItem} isOpen={!!editingItem} onClose={() => setEditingItem(null)} refetch={refetch} />}
        {deletingItem && <DeleteConfirmationModal item={deletingItem} isOpen={!!deletingItem} onClose={() => setDeletingItem(null)} refetch={refetch} />}
      </AnimatePresence>
    </div>
  );
};
const JrdAssets = () => (<GsapProvider><JrdAssetsContent /></GsapProvider>);
export default JrdAssets;