import { useCallback, useState, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  UploadCloud, 
  Settings, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music,
  Sparkles,
  Link as LinkIcon,
  Edit2,
  Clock,
  ArrowRight,
  Check,
  X,
  Loader2,
  Search,
  Plus,
  User,
  HardDrive,
  Layers,
  Info,
  ArrowUp,
  ArrowDown,
  Calendar
} from 'lucide-react';
import client from '../api/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import AssetThumbnail from '../components/AssetThumbnail';
import { useAuth } from '../context/AuthContext';

// --- STYLES FOR ANIMATION ---
const customStyles = `
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .animate-shimmer {
    animation: shimmer 3s linear infinite;
  }
  /* Fix date picker calendar icon color in dark mode */
  input[type="date"]::-webkit-calendar-picker-indicator {
      cursor: pointer;
      opacity: 0.6;
      transition: 0.2s;
  }
  input[type="date"]::-webkit-calendar-picker-indicator:hover {
      opacity: 1;
  }
  .dark input[type="date"]::-webkit-calendar-picker-indicator {
      filter: invert(1);
  }
`;

// --- TYPES ---
interface ExtendedFile extends File { preview?: string; }

interface UploadItem { 
  file: ExtendedFile; 
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error'; 
  progress: number;
  newName: string;
  externalLinks: string[]; 
  customUploader: string;
  errorMessage?: string;
}

interface RecentAsset {
  id: string;
  originalName: string;
  mimeType: string;
  createdAt: string;
  thumbnailPath: string | null;
  path: string;
  previewFrames?: string[];
  uploadedBy?: { name: string };
  aiData?: string;
  displayUploader?: string; 
  tagsStr?: string;
}

const formatSafeDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown Date';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Unknown Date' : d.toLocaleDateString();
};

const Upload = () => {
  useAuth();
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false); 
  const [recentUploads, setRecentUploads] = useState<RecentAsset[]>([]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [creativity, setCreativity] = useState(0.2);
  const [specificity, setSpecificity] = useState<'general' | 'high'>('general');

  // Modals & Filters
  const [isRecentModalOpen, setIsRecentModalOpen] = useState(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false); 
  
  // ✅ CLEANED UP FILTER STATES
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [dateStart, setDateStart] = useState<string>(''); 
  const [dateEnd, setDateEnd] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'uploader'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const overallProgress = queue.length > 0 
    ? Math.min(100, Math.max(0, Math.round(queue.reduce((acc, item) => acc + item.progress, 0) / queue.length)))
    : 0;

  const fetchRecent = async () => {
    try {
      const res = await client.get('/assets?limit=50'); 
      const results = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setRecentUploads(results);
    } catch (error) { console.warn("Could not fetch history"); }
  };

  useEffect(() => { fetchRecent(); }, []);

  // ✅ LOGIC: Range Filter + Uploader Sort
  const processedRecentUploads = useMemo(() => {
    
    // 1. Pre-process to extract customUploader and tags
    const enrichedAssets = recentUploads.map(asset => {
        let customUploader = '';
        let tagsStr = '';
        try {
            if (asset.aiData) {
                const parsed = JSON.parse(asset.aiData);
                customUploader = parsed.customUploader || '';
                if (Array.isArray(parsed.tags)) tagsStr = parsed.tags.join(' ').toLowerCase();
            }
        } catch(e) {}

        const displayUploader = customUploader || asset.uploadedBy?.name || 'Unknown';
        return { ...asset, displayUploader, tagsStr };
    });

    // 2. Filter Results (Search + Date Range)
    let arr = enrichedAssets.filter(asset => {
        const query = modalSearchQuery.toLowerCase();
        const fileName = (asset.originalName || '').toLowerCase();
        const uploaderSearch = asset.displayUploader.toLowerCase();

        const matchesSearch = !query || 
            fileName.includes(query) || 
            uploaderSearch.includes(query) || 
            asset.tagsStr!.includes(query);
        
        let matchesDate = true;
        const assetTime = new Date(asset.createdAt).getTime();

        if (dateStart) {
            const start = new Date(dateStart);
            start.setHours(0, 0, 0, 0); // Start of day
            if (assetTime < start.getTime()) matchesDate = false;
        }
        
        if (dateEnd) {
            const end = new Date(dateEnd);
            end.setHours(23, 59, 59, 999); // End of day
            if (assetTime > end.getTime()) matchesDate = false;
        }

        return matchesSearch && matchesDate;
    });

    // 3. Sort Results
    return arr.sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'date') comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortBy === 'name') comparison = (a.originalName || '').localeCompare(b.originalName || '');
        if (sortBy === 'uploader') comparison = a.displayUploader.localeCompare(b.displayUploader);
        
        // Reverse if Descending
        return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [recentUploads, sortBy, sortOrder, modalSearchQuery, dateStart, dateEnd]);

  // --- DROPZONE ---
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems: UploadItem[] = acceptedFiles.map(file => ({
      file: Object.assign(file, {
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      }),
      id: Math.random().toString(36).substring(7),
      status: 'pending',
      progress: 0,
      newName: file.name,
      externalLinks: [''],
      customUploader: ''
    }));
  
    setQueue(prev => {
        const updated = [...prev, ...newItems];
        if (prev.length === 0 && updated.length > 0) setIsQueueModalOpen(true);
        return updated;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: { 'image/*': [], 'video/*': [], 'audio/*': [] }
  });

  useEffect(() => {
    return () => queue.forEach(item => { if (item.file.preview) URL.revokeObjectURL(item.file.preview); });
  }, [queue]);

  const removeFile = (index: number) => {
      setQueue(prev => {
          const newQ = prev.filter((_, i) => i !== index);
          if (newQ.length === 0) setIsQueueModalOpen(false); 
          return newQ;
      });
  };

  const updateItem = (index: number, field: keyof UploadItem, value: string) => {
    setQueue(prev => {
        const newQueue = [...prev];
        newQueue[index] = { ...newQueue[index], [field]: value } as any;
        return newQueue;
    });
  };

  const updateLink = (itemIndex: number, linkIndex: number, value: string) => {
      setQueue(prev => {
          const newQueue = [...prev];
          const newLinks = [...newQueue[itemIndex].externalLinks];
          newLinks[linkIndex] = value;
          newQueue[itemIndex] = { ...newQueue[itemIndex], externalLinks: newLinks };
          return newQueue;
      });
  };

  const addLinkField = (itemIndex: number) => {
      setQueue(prev => {
          const newQueue = [...prev];
          newQueue[itemIndex] = { ...newQueue[itemIndex], externalLinks: [...newQueue[itemIndex].externalLinks, ''] };
          return newQueue;
      });
  };

  const removeLinkField = (itemIndex: number, linkIndex: number) => {
      setQueue(prev => {
          const newQueue = [...prev];
          const newLinks = [...newQueue[itemIndex].externalLinks];
          newLinks.splice(linkIndex, 1);
          newQueue[itemIndex] = { ...newQueue[itemIndex], externalLinks: newLinks };
          return newQueue;
      });
  };

  const startUpload = async () => {
    if (queue.length === 0) return;

    const hasValidationErrors = queue.some(item => {
        const hasUploader = item.customUploader.trim() !== '';
        const hasValidLink = item.externalLinks.some(link => link.trim() !== '');
        return !hasUploader || !hasValidLink;
    });

    if (hasValidationErrors) {
        toast.error('⚠️ Upload halted: Please ensure every file has a Credit/Uploader name and at least one Source Link.', { autoClose: 5000 });
        setIsQueueModalOpen(true); 
        return;
    }

    setIsProcessing(true);
    setIsQueueModalOpen(false); 
    let successCount = 0;
    
    const currentQueue = [...queue];

    for (let i = 0; i < currentQueue.length; i++) {
      if (currentQueue[i].status === 'success') {
          successCount++;
          continue;
      }

      setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading' } : item));

      const formData = new FormData();
      formData.append('file', currentQueue[i].file);
      formData.append('originalName', currentQueue[i].newName);
      formData.append('creativity', creativity.toString());
      formData.append('specificity', specificity);
      
      const validLinks = currentQueue[i].externalLinks.filter(link => link.trim() !== '');
      const aiDataObj: any = {};
      
      if (validLinks.length > 0) {
          aiDataObj.externalLink = validLinks[0];
          aiDataObj.links = validLinks;
      }
      
      if (currentQueue[i].customUploader.trim() !== '') {
          aiDataObj.customUploader = currentQueue[i].customUploader.trim();
      }
      
      if (Object.keys(aiDataObj).length > 0) {
          formData.append('aiData', JSON.stringify(aiDataObj));
      }

      try {
        await client.post('/assets/upload', formData, { 
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
                const total = progressEvent.total || currentQueue[i].file.size;
                const percent = Math.round((progressEvent.loaded * 100) / total);
                setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, progress: percent } : item));
            }
        });
        setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'success', progress: 100 } : item));
        successCount++;
      } catch (err: any) {
        setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', errorMessage: 'Failed' } : item));
        toast.error(`Error uploading ${currentQueue[i].newName}`);
      }
    }
    
    setIsProcessing(false);
    fetchRecent();

    if (successCount === currentQueue.length) {
      setIsRedirecting(true);
      toast.success('🚀 Complete! Moving to Library...');
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      setTimeout(() => {
          setIsQueueModalOpen(false);
          navigate('/library');
      }, 1500);
    } else {
      toast.warning('Some files failed to upload.');
      setIsQueueModalOpen(true); 
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon size={20} className="text-purple-500" />;
    if (mimeType.startsWith('video/')) return <Film size={20} className="text-pink-500" />;
    if (mimeType.startsWith('audio/')) return <Music size={20} className="text-yellow-500" />;
    return <FileText size={20} className="text-blue-500" />;
  };

  const getCreativityLabel = (val: number) => {
      if (val <= 0.2) return "Precise (Strict)";
      if (val <= 0.5) return "Balanced";
      if (val <= 0.8) return "Creative";
      return "Imaginative (Wild)";
  };

  const getButtonContent = () => {
      if (isRedirecting) return <><Check size={20} className="animate-bounce" /> <span>Redirecting...</span></>;
      if (isProcessing) {
          if (overallProgress >= 100) return <><Loader2 size={20} className="animate-spin" /><span>Finalizing...</span></>;
          return <span>Uploading {overallProgress}%</span>;
      }
      return <><span>Upload {queue.length > 0 ? queue.length : ''} Files</span> <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-[#0B0D0F] dark:via-[#131619] dark:to-[#0F0B15] pb-20 transition-colors duration-500 relative">
      <style>{customStyles}</style>
      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        
        {/* HEADER */}
        <div className="mb-8 animate-in slide-in-from-top-4 duration-700 fade-in">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white dark:bg-white/5 rounded-2xl shadow-sm shadow-indigo-100 dark:shadow-none border border-indigo-50 dark:border-white/10"><UploadCloud className="text-indigo-600 dark:text-indigo-400" size={32} /></div>
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Upload Assets</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">Drag & drop or paste files <Sparkles size={14} className="text-yellow-400 fill-yellow-400 animate-pulse" /></p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-6">
              
              {/* UPLOAD GUIDELINES */}
              <div className="bg-blue-50/80 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 p-5 rounded-3xl flex items-start gap-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-800/30 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
                      <Info size={24} />
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2 mt-0.5">
                      <p className="font-bold text-blue-800 dark:text-blue-300 text-base">Before you upload:</p>
                      <ul className="list-disc pl-5 space-y-1 opacity-90">
                          <li>You can edit the filename before you upload.</li>
                          <li>You <strong className="text-blue-700 dark:text-blue-400">must</strong> provide a Credit/Uploader name.</li>
                          <li>You <strong className="text-blue-700 dark:text-blue-400">must</strong> include at least one or two working Source Link (e.g., Google Drive URL).</li>
                          <li>You can find the task card on the right sidebar.</li>
                      </ul>
                  </div>
              </div>

              {/* DROPZONE */}
              <div {...getRootProps()} className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-500 ease-out h-56 flex flex-col items-center justify-center text-center cursor-pointer group ${isDragActive ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 scale-[1.02] shadow-xl ring-4 ring-indigo-100 dark:ring-indigo-900/30' : 'border-gray-300 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-white/10'}`}>
                  <input {...getInputProps()} />
                  <div className="z-10 flex flex-col items-center">
                      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 transition-transform duration-500 ${isDragActive ? 'scale-110 rotate-12' : 'group-hover:scale-110 group-hover:-rotate-3'}`}><UploadCloud size={24} /></div>
                      <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">Click to upload</h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Images, Video & Audio</p>
                  </div>
              </div>

              {/* QUEUE SUMMARY BOX */}
              {queue.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-3xl p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between shadow-sm gap-4">
                      <div className="flex items-center gap-5 w-full sm:w-auto">
                          <div className="flex -space-x-4 pl-2 shrink-0">
                              {queue.slice(0, 4).map((item, i) => (
                                  <div key={item.id} className="w-12 h-12 rounded-xl border-2 border-white dark:border-[#1A1D21] bg-gray-100 dark:bg-black/40 overflow-hidden flex items-center justify-center shadow-sm relative" style={{ zIndex: 10 - i }}>
                                      {item.file.preview ? <img src={item.file.preview} className="w-full h-full object-cover" alt="" /> : getFileIcon(item.file.type)}
                                  </div>
                              ))}
                              {queue.length > 4 && (
                                  <div className="w-12 h-12 rounded-xl border-2 border-white dark:border-[#1A1D21] bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 relative" style={{ zIndex: 0 }}>
                                      +{queue.length - 4}
                                  </div>
                              )}
                          </div>
                          <div className="min-w-0 flex-1">
                              <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">{queue.length} file{queue.length !== 1 ? 's' : ''} in queue</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">Ready to be processed and uploaded.</p>
                          </div>
                      </div>

                      <div className="flex gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                          <button onClick={() => setQueue([])} disabled={isProcessing} className="flex-1 sm:flex-none px-4 py-2.5 text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold text-sm transition-colors disabled:opacity-50">Clear</button>
                          <button onClick={() => setIsQueueModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl font-bold text-sm transition-colors">
                              <Layers size={16} /> Review
                          </button>
                      </div>
                  </motion.div>
              )}
          </div>

          {/* RIGHT COLUMN (STICKY) */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 space-y-6">

                {/* ACTION BUTTON */}
                <button
                    onClick={startUpload}
                    disabled={isProcessing || isRedirecting || queue.length === 0}
                    className={`
                        relative overflow-hidden w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-300 flex items-center justify-center gap-3 group
                        ${isProcessing || isRedirecting
                            ? 'bg-gray-800 text-white shadow-none cursor-wait' 
                            : queue.length === 0 
                                ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed shadow-none' 
                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:scale-[1.02] hover:shadow-indigo-500/30'
                        }
                    `}
                >
                    {(isProcessing || isRedirecting) && (
                        <div className={`absolute left-0 top-0 bottom-0 bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-600 bg-[length:200%_100%] animate-shimmer transition-all duration-300 ease-out z-0`} style={{ width: isRedirecting ? '100%' : `${overallProgress}%` }} />
                    )}
                    <span className="relative z-10 flex items-center gap-2 drop-shadow-sm">{getButtonContent()}</span>
                </button>
                
                {/* AI SETTINGS */}
                <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1D21] p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-gray-800 dark:text-white">
                        <Settings size={18} className="text-gray-500" />
                        <h3 className="font-bold text-sm">AI Configuration</h3>
                    </div>
                    <div className="space-y-6">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Tagging Mode</label>
                            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-black/20 rounded-xl">
                                <button onClick={() => setSpecificity('general')} className={`py-2 text-xs font-bold rounded-lg transition-all ${specificity === 'general' ? 'bg-white dark:bg-white/10 text-black dark:text-white shadow-sm border border-gray-200 dark:border-white/5' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-transparent'}`}>Standard</button>
                                <button onClick={() => setSpecificity('high')} className={`py-2 text-xs font-bold rounded-lg transition-all ${specificity === 'high' ? 'bg-indigo-600 text-white shadow-sm border border-indigo-700' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-transparent'}`}>Deep Scan</button>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Creativity</label>
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{Math.round(creativity * 100)}%</span>
                            </div>
                            <input type="range" min="0" max="1" step="0.1" value={creativity} onChange={e => setCreativity(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                            <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400 leading-snug">{getCreativityLabel(creativity)} mode.</p>
                        </div>
                    </div>
                </div>

                {/* RECENT UPLOADS BUTTON */}
                {recentUploads.length > 0 && (
                    <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1D21] p-6 shadow-sm animate-in fade-in slide-in-from-right-4 duration-700">
                        <div className="flex items-center gap-3 mb-2 text-gray-800 dark:text-white">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg"><Clock size={20} /></div>
                            <h3 className="font-bold text-sm">Upload History</h3>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">Need to retrieve something you just uploaded? View and manage your recent files here.</p>
                        <button onClick={() => setIsRecentModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-white/5 hover:border-blue-300 dark:hover:border-blue-500/50 transition-all text-sm font-bold text-gray-700 dark:text-gray-300 group">View All Recent <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform text-blue-500" /></button>
                    </div>
                )}
            </div>
          </div>

        </div>
      </div>

      {/* ✅ REFINED QUEUE REVIEW MODAL */}
      <AnimatePresence>
          {isQueueModalOpen && queue.length > 0 && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  {/* Backdrop */}
                  <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                      onClick={() => setIsQueueModalOpen(false)} 
                  />
                  
                  {/* Modal Panel */}
                  <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                      className="relative w-full max-w-5xl bg-[#F8F9FC] dark:bg-[#0B0D0F] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 dark:border-white/10"
                  >
                      {/* Header */}
                      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] shrink-0">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg"><Layers size={20} /></div>
                              <div>
                                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Review Queue</h3>
                                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{queue.length} files selected</p>
                              </div>
                          </div>
                          <button onClick={() => setIsQueueModalOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10"><X size={20} /></button>
                      </div>

                      {/* Modal Content */}
                      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-3 bg-gray-50/30 dark:bg-black/20">
                          {queue.map((item, index) => {
                              const isMissingUploader = item.customUploader.trim() === '';
                              const isMissingLink = !item.externalLinks.some(link => link.trim() !== '');

                              return (
                                <div key={item.id} className={`relative bg-white dark:bg-[#1A1D21] border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-4 md:items-start group overflow-hidden ${isMissingUploader || isMissingLink ? 'border-red-300 dark:border-red-900/50' : 'border-gray-200 dark:border-white/5'}`}>
                                    
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <div className="flex justify-between items-start mb-5">
                                        <div className="flex items-center gap-4">
                                            <div className="h-16 w-16 shrink-0 bg-gray-50 dark:bg-black/40 rounded-xl overflow-hidden border border-gray-100 dark:border-white/5 flex items-center justify-center relative">
                                                {item.file.preview ? <img src={item.file.preview} className="h-full w-full object-cover" alt="" /> : getFileIcon(item.file.type)}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-sm">{item.file.name}</h4>
                                                <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                                                    <span className="flex items-center gap-1"><HardDrive size={10} /> {(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
                                                </div>
                                            </div>
                                        </div>
                                        {item.status === 'pending' && (
                                            <button onClick={() => removeFile(index)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><X size={16} /></button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 flex-1">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Display Name</label>
                                                <div className="flex items-center bg-gray-50 dark:bg-[#0B0D0F]/50 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all hover:border-gray-300 dark:hover:border-white/20">
                                                    <Edit2 size={14} className="text-gray-400 mr-2 shrink-0" />
                                                    <input type="text" value={item.newName} onChange={(e) => updateItem(index, 'newName', e.target.value)} disabled={item.status !== 'pending'} className="w-full bg-transparent text-sm font-medium text-gray-900 dark:text-white outline-none placeholder-gray-400" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block ml-1 ${isMissingUploader ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                                    Credit / Uploader <span className="text-red-500">*</span>
                                                </label>
                                                <div className={`flex items-center bg-gray-50 dark:bg-[#0B0D0F]/50 border rounded-xl px-3 py-2.5 focus-within:ring-2 transition-all hover:border-gray-300 dark:hover:border-white/20 ${isMissingUploader ? 'border-red-300 dark:border-red-900 focus-within:ring-red-500/50' : 'border-gray-200 dark:border-white/10 focus-within:ring-indigo-500/50'}`}>
                                                    <User size={14} className={isMissingUploader ? 'text-red-400 mr-2 shrink-0' : 'text-gray-400 mr-2 shrink-0'} />
                                                    <input type="text" value={item.customUploader} onChange={(e) => updateItem(index, 'customUploader', e.target.value)} disabled={item.status !== 'pending'} className="w-full bg-transparent text-sm font-medium text-gray-900 dark:text-white outline-none placeholder-gray-400" placeholder="DAM uploader doing the task" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-3 md:border-l md:border-gray-100 md:dark:border-white/5 md:pl-8">
                                            <div className="flex items-center justify-between">
                                                <label className={`text-[10px] font-bold uppercase tracking-widest block ml-1 ${isMissingLink ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                                    Source Links <span className="text-red-500">*</span>
                                                </label>
                                                {item.status === 'pending' && (
                                                    <button onClick={() => addLinkField(index)} className="text-[10px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-2 py-1 rounded flex items-center gap-1 transition-colors"><Plus size={10} /> Add Link</button>
                                                )}
                                            </div>
                                            <div className="space-y-2.5">
                                                {item.externalLinks.map((link, lIndex) => (
                                                    <div key={lIndex} className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 group/link">
                                                        <div className={`flex flex-1 items-center bg-gray-50 dark:bg-[#0B0D0F]/50 rounded-lg px-2 py-1.5 border focus-within:ring-1 transition-colors ${isMissingLink ? 'border-red-300 dark:border-red-900 focus-within:ring-red-500 focus-within:border-red-500' : 'border-gray-200 dark:border-white/10 focus-within:ring-indigo-500 focus-within:border-indigo-500'}`}>
                                                          <LinkIcon size={12} className={isMissingLink ? 'text-red-400 shrink-0 mr-2' : 'text-gray-400 shrink-0 mr-2'} />
                                                          <input 
                                                              type="url" 
                                                              value={link} 
                                                              onChange={(e) => updateLink(index, lIndex, e.target.value)} 
                                                              disabled={item.status !== 'pending'} 
                                                              className="w-full bg-transparent text-xs text-gray-800 dark:text-gray-200 outline-none placeholder-gray-400" 
                                                              placeholder="https://..." 
                                                          />
                                                        </div>
                                                        {item.status === 'pending' && item.externalLinks.length > 1 && (
                                                            <button onClick={() => removeLinkField(index, lIndex)} className="opacity-0 group-hover/link:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all shrink-0"><X size={14} /></button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {item.status !== 'pending' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100 dark:bg-white/5">
                                            <div className={`h-full transition-all duration-300 ${item.status === 'success' ? 'bg-green-500' : item.status === 'error' ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${item.progress}%` }} />
                                        </div>
                                    )}
                                </div>
                              );
                          })}
                      </div>

                      {/* Footer Actions */}
                      <div className="p-4 border-t border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] shrink-0 flex items-center justify-between gap-3">
                          <button onClick={() => setIsQueueModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">Close / Edit More</button>
                          
                          <button
                              onClick={startUpload}
                              disabled={isProcessing || isRedirecting || queue.length === 0}
                              className={`
                                  relative overflow-hidden px-8 py-2.5 rounded-xl font-bold shadow-md transition-all duration-300 flex items-center gap-2
                                  ${isProcessing || isRedirecting
                                      ? 'bg-gray-800 text-white cursor-wait shadow-none' 
                                      : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
                                  }
                              `}
                          >
                              {(isProcessing || isRedirecting) && (
                                  <div className={`absolute left-0 top-0 bottom-0 bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-600 bg-[length:200%_100%] animate-shimmer z-0`} style={{ width: isRedirecting ? '100%' : `${overallProgress}%` }} />
                              )}
                              <span className="relative z-10 flex items-center gap-2">
                                  {getButtonContent()}
                              </span>
                          </button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* ✅ RECENT UPLOADS MODAL */}
      <AnimatePresence>
          {isRecentModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsRecentModalOpen(false)} />
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-6xl bg-white dark:bg-[#1A1D21] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-white/10">
                      
                      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black/20 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><Clock size={20} /> </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Uploads</h3>
                        </div>
                        <button onClick={() => setIsRecentModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10"><X size={20} /></button>
                      </div>
                      
                      {/* ✅ ULTRA-CLEAN CONTROLS SECTION */}
                      <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#1A1D21] shrink-0">
                          
                          {/* Left: Search */}
                          <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Search files, tags, or uploaders..." 
                                value={modalSearchQuery} 
                                onChange={(e) => setModalSearchQuery(e.target.value)} 
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                            />
                          </div>

                          {/* Right: Date Picker & New Sorting Pills */}
                          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                              
                              {/* Date Pickers */}
                              <div className="flex items-center bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 transition-all gap-2 group relative">
                                  <Calendar size={15} className="text-gray-400 shrink-0" />
                                  <input 
                                      type="date" 
                                      title="Start Date"
                                      value={dateStart}
                                      onChange={(e) => setDateStart(e.target.value)}
                                      className="bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 outline-none cursor-pointer w-28"
                                  />
                                  <span className="text-gray-400">-</span>
                                  <input 
                                      type="date" 
                                      title="End Date"
                                      value={dateEnd}
                                      onChange={(e) => setDateEnd(e.target.value)}
                                      className="bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 outline-none cursor-pointer w-28"
                                  />
                                  {(dateStart || dateEnd) && (
                                      <button 
                                          onClick={() => { setDateStart(''); setDateEnd(''); }} 
                                          className="absolute right-2 p-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-all"
                                          title="Clear Dates"
                                      >
                                          <X size={12} strokeWidth={3} />
                                      </button>
                                  )}
                              </div>

                              {/* NEW: Sleek Pill Sorting Group */}
                              <div className="flex items-center bg-gray-50 dark:bg-black/20 p-1 rounded-xl border border-gray-200 dark:border-white/10">
                                  {['date', 'name', 'uploader'].map(metric => (
                                      <button
                                          key={metric}
                                          onClick={() => setSortBy(metric as any)}
                                          className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize transition-all ${sortBy === metric ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                      >
                                          {metric}
                                      </button>
                                  ))}
                                  
                                  {/* Divider */}
                                  <div className="w-px h-4 bg-gray-300 dark:bg-white/10 mx-1" />
                                  
                                  {/* Direction Toggle */}
                                  <button
                                      onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                      className="flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-all"
                                      title={sortOrder === 'asc' ? "Sorting Ascending" : "Sorting Descending"}
                                  >
                                      {sortOrder === 'asc' ? <ArrowUp size={14} strokeWidth={3} /> : <ArrowDown size={14} strokeWidth={3} />}
                                  </button>
                              </div>
                          </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/50 dark:bg-[#0B0D0F]/30">
                          {processedRecentUploads.length === 0 ? (
                              <div className="text-center py-20 flex flex-col items-center justify-center opacity-60">
                                  <Search size={40} className="mb-4 text-gray-400" />
                                  <p className="text-gray-500 text-lg font-medium">No results found.</p>
                                  {(dateStart || dateEnd || modalSearchQuery) && <p className="text-sm mt-2 text-gray-400">Try clearing your search or date filters.</p>}
                              </div>
                          ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {processedRecentUploads.map(recent => (
                                      <div key={recent.id} className="flex flex-col p-4 bg-white dark:bg-[#1A1D21] hover:bg-blue-50 dark:hover:bg-white/5 rounded-2xl transition-colors group border border-gray-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-white/10 cursor-pointer shadow-sm hover:shadow" onClick={() => { setIsRecentModalOpen(false); navigate(`/assets/${recent.id}`); }}>
                                          
                                          <div className="flex items-center gap-4 min-w-0">
                                              <div className="h-16 w-16 bg-gray-100 dark:bg-black/40 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-gray-200 dark:border-white/5 relative">
                                                  <AssetThumbnail mimeType={recent.mimeType} thumbnailPath={recent.thumbnailPath || recent.path} previewFrames={recent.previewFrames} className="w-full h-full object-cover" />
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={recent.originalName}>{recent.originalName}</p>
                                                  
                                                  {/* ✅ SHOW ACTUAL UPLOADER NAME (from aiData customUploader) */}
                                                  {recent.displayUploader && (
                                                      <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                                                          <User size={10} /> {recent.displayUploader}
                                                      </p>
                                                  )}

                                                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                                                      <span className="bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-md">{recent.mimeType.split('/')[1]}</span>
                                                      <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></span>
                                                      <span>{formatSafeDate(recent.createdAt)}</span>
                                                  </div>
                                              </div>
                                              <div className="shrink-0 p-2 rounded-full bg-white dark:bg-black/20 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                                                  <ArrowRight size={16} className="text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-transform group-hover:translate-x-0.5" />
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>
    </div>
  );
};

export default Upload;