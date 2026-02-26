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
  Search
} from 'lucide-react';
import client from '../api/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import AssetThumbnail from '../components/AssetThumbnail';

// --- STYLES FOR ANIMATION ---
const customStyles = `
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .animate-shimmer {
    animation: shimmer 3s linear infinite;
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
  externalLink: string;
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
}

// --- HELPER ---
const formatSafeDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown Date';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Unknown Date' : d.toLocaleDateString();
};

const Upload = () => {
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false); 
  const [recentUploads, setRecentUploads] = useState<RecentAsset[]>([]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // AI Settings
  const [creativity, setCreativity] = useState(0.2);
  const [specificity, setSpecificity] = useState<'general' | 'high'>('general');

  // Modal & Sorting/Searching State
  const [isRecentModalOpen, setIsRecentModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<'newest' | 'oldest' | 'a-z' | 'z-a'>('newest');

  // --- CALCULATE OVERALL PROGRESS ---
  const overallProgress = queue.length > 0 
    ? Math.min(100, Math.max(0, Math.round(queue.reduce((acc, item) => acc + item.progress, 0) / queue.length)))
    : 0;

  // --- FETCH HISTORY ---
  const fetchRecent = async () => {
    try {
      const res = await client.get('/assets?limit=30');
      const results = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setRecentUploads(results);
    } catch (error) { console.warn("Could not fetch history"); }
  };

  useEffect(() => { fetchRecent(); }, []);

  // --- FILTER & SORT LOGIC ---
  const processedRecentUploads = useMemo(() => {
    // 1. Filter by search query
    let arr = recentUploads.filter(asset => 
        (asset.originalName || '').toLowerCase().includes(modalSearchQuery.toLowerCase())
    );

    // 2. Sort the filtered array
    switch (sortConfig) {
        case 'oldest': 
            return arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        case 'a-z': 
            return arr.sort((a, b) => (a.originalName || '').localeCompare(b.originalName || ''));
        case 'z-a': 
            return arr.sort((a, b) => (b.originalName || '').localeCompare(a.originalName || ''));
        case 'newest':
        default:
            return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [recentUploads, sortConfig, modalSearchQuery]);

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
      externalLink: ''
    }));
    setQueue(prev => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: { 
        'image/*': [], 
        'video/*': [], 
        'audio/*': [] 
    }
  });

  useEffect(() => {
    return () => queue.forEach(item => {
      if (item.file.preview) URL.revokeObjectURL(item.file.preview);
    });
  }, [queue]);

  // --- ACTIONS ---
  const removeFile = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof UploadItem, value: string) => {
    setQueue(prev => {
        const newQueue = [...prev];
        newQueue[index] = { ...newQueue[index], [field]: value };
        return newQueue;
    });
  };

  const startUpload = async () => {
    if (queue.length === 0) return;
    setIsProcessing(true);
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
      
      if (currentQueue[i].externalLink) {
          const aiData = JSON.stringify({ externalLink: currentQueue[i].externalLink });
          formData.append('aiData', aiData);
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
          navigate('/library');
      }, 1500);
    } else {
      toast.warning('Some files failed to upload.');
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
      if (isRedirecting) {
          return (
              <>
                  <Check size={20} className="animate-bounce" /> 
                  <span>Done! Redirecting...</span>
              </>
          );
      }
      if (isProcessing) {
          if (overallProgress >= 100) {
              return (
                  <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Finalizing & Tagging...</span>
                  </>
              );
          }
          return <span>Uploading {overallProgress}%</span>;
      }
      return (
          <>
              <span>Start Upload</span> 
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </>
      );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-[#0B0D0F] dark:via-[#131619] dark:to-[#0F0B15] pb-20 transition-colors duration-500 relative">
      
      <style>{customStyles}</style>

      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        
        {/* HEADER */}
        <div className="mb-8 animate-in slide-in-from-top-4 duration-700 fade-in">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white dark:bg-white/5 rounded-2xl shadow-sm shadow-indigo-100 dark:shadow-none border border-indigo-50 dark:border-white/10">
                <UploadCloud className="text-indigo-600 dark:text-indigo-400" size={32} />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Upload Assets</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                   Drag & drop or paste files <Sparkles size={14} className="text-yellow-400 fill-yellow-400 animate-pulse" />
                </p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-6">
              
              {/* DROPZONE */}
              <div
                  {...getRootProps()}
                  className={`
                    relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-500 ease-out h-56 flex flex-col items-center justify-center text-center cursor-pointer group
                    ${isDragActive 
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 scale-[1.02] shadow-xl ring-4 ring-indigo-100 dark:ring-indigo-900/30' 
                      : 'border-gray-300 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-white/10'
                    }
                  `}
              >
                  <input {...getInputProps()} />
                  <div className="z-10 flex flex-col items-center">
                      <div className={`
                        mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 transition-transform duration-500
                        ${isDragActive ? 'scale-110 rotate-12' : 'group-hover:scale-110 group-hover:-rotate-3'}
                      `}>
                          <UploadCloud size={24} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">Click to upload</h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Images, Video & Audio</p>
                  </div>
              </div>

              {/* QUEUE LIST */}
              {queue.length > 0 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center justify-between px-2">
                          <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">Ready to Process ({queue.length})</h3>
                          <button onClick={() => setQueue([])} className="text-xs text-red-500 hover:underline disabled:opacity-50" disabled={isProcessing}>Clear All</button>
                      </div>

                      {queue.map((item, index) => (
                          <div key={item.id} className="relative bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex gap-4">
                                  <div className="h-20 w-20 shrink-0 bg-gray-100 dark:bg-black/20 rounded-xl overflow-hidden border border-gray-100 dark:border-white/5 flex items-center justify-center relative">
                                      {item.file.preview ? (
                                          <img src={item.file.preview} className="h-full w-full object-cover" alt="" /> 
                                      ) : (
                                          getFileIcon(item.file.type)
                                      )}
                                  </div>

                                  <div className="flex-1 space-y-3 min-w-0">
                                      <div>
                                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">File Name</label>
                                          <div className="flex items-center bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                                              <Edit2 size={14} className="text-gray-400 mr-2" />
                                              <input type="text" value={item.newName} onChange={(e) => updateItem(index, 'newName', e.target.value)} disabled={item.status !== 'pending'} className="w-full bg-transparent text-sm font-medium text-gray-800 dark:text-white outline-none placeholder-gray-400" />
                                          </div>
                                      </div>

                                      <div>
                                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Source Link (Optional)</label>
                                          <div className="flex items-center bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                                              <LinkIcon size={14} className="text-gray-400 mr-2" />
                                              <input type="text" value={item.externalLink} onChange={(e) => updateItem(index, 'externalLink', e.target.value)} disabled={item.status !== 'pending'} className="w-full bg-transparent text-xs text-gray-600 dark:text-gray-300 outline-none placeholder-gray-400" placeholder="https://drive.google.com/..." />
                                          </div>
                                      </div>
                                  </div>

                                  {item.status === 'pending' && <button onClick={() => removeFile(index)} className="self-start p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><X size={18} /></button>}
                              </div>

                              {item.status !== 'pending' && (
                                  <div className="mt-4">
                                      <div className="flex justify-between text-[10px] font-bold mb-1 uppercase tracking-wider">
                                          <span className={item.status === 'error' ? 'text-red-500' : 'text-indigo-600'}>{item.status === 'success' ? 'Complete' : item.status === 'error' ? 'Failed' : 'Uploading...'}</span>
                                          <span className="text-gray-400">{item.progress}%</span>
                                      </div>
                                      <div className="h-1.5 w-full bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                          <div className={`h-full transition-all duration-300 ${item.status === 'success' ? 'bg-green-500' : item.status === 'error' ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${item.progress}%` }} />
                                      </div>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-4 space-y-6">

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
                  {/* PROGRESS FILL LAYER (Animated Shimmer) */}
                  {(isProcessing || isRedirecting) && (
                      <div 
                          className={`
                            absolute left-0 top-0 bottom-0 
                            bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-600
                            bg-[length:200%_100%] animate-shimmer 
                            transition-all duration-300 ease-out z-0
                          `}
                          style={{ width: isRedirecting ? '100%' : `${overallProgress}%` }}
                      />
                  )}

                  {/* TEXT LAYER */}
                  <span className="relative z-10 flex items-center gap-2 drop-shadow-sm">
                      {getButtonContent()}
                  </span>
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
                              <button onClick={() => setSpecificity('general')} className={`py-2 text-xs font-bold rounded-lg transition-all ${specificity === 'general' ? 'bg-white dark:bg-white/10 text-black dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Standard</button>
                              <button onClick={() => setSpecificity('high')} className={`py-2 text-xs font-bold rounded-lg transition-all ${specificity === 'high' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Deep Scan</button>
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

              {/* RECENT UPLOADS BUTTON (Side Panel) */}
              {recentUploads.length > 0 && (
                  <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1D21] p-6 shadow-sm animate-in fade-in slide-in-from-right-4 duration-700">
                      <div className="flex items-center gap-3 mb-2 text-gray-800 dark:text-white">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                              <Clock size={20} />
                          </div>
                          <h3 className="font-bold text-sm">Upload History</h3>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
                          Need to retrieve something you just uploaded? View and manage your recent files here.
                      </p>
                      
                      {/* SIDE PANEL PREVIEW LIST WITH ACTUAL THUMBNAILS */}
                      <div className="space-y-2 mb-5">
                          {recentUploads.slice(0, 3).map(recent => (
                              <div key={recent.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                                  <div className="h-10 w-10 bg-gray-200 dark:bg-black/40 rounded-lg overflow-hidden shrink-0">
                                      <AssetThumbnail 
                                          mimeType={recent.mimeType} 
                                          thumbnailPath={recent.thumbnailPath || recent.path} 
                                          previewFrames={recent.previewFrames}
                                          className="w-full h-full object-cover" 
                                      />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">{recent.originalName}</p>
                                      <p className="text-[10px] text-gray-400 mt-0.5">{formatSafeDate(recent.createdAt)}</p>
                                  </div>
                              </div>
                          ))}
                      </div>

                      <button 
                          onClick={() => setIsRecentModalOpen(true)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-white/5 hover:border-blue-300 dark:hover:border-blue-500/50 transition-all text-sm font-bold text-gray-700 dark:text-gray-300 group"
                      >
                          View All Recent <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform text-blue-500" />
                      </button>
                  </div>
              )}

          </div>
        </div>
      </div>

      {/* ✅ RECENT UPLOADS MODAL (Wider, Searchable, 3-Column Grid) */}
      <AnimatePresence>
          {isRecentModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  {/* Backdrop */}
                  <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                      onClick={() => setIsRecentModalOpen(false)} 
                  />
                  
                  {/* Modal Panel - Increased to max-w-6xl */}
                  <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                      animate={{ opacity: 1, scale: 1, y: 0 }} 
                      exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                      className="relative w-full max-w-6xl bg-white dark:bg-[#1A1D21] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-white/10"
                  >
                      {/* Header */}
                      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black/20 shrink-0">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                  <Clock size={20} /> 
                              </div>
                              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Uploads</h3>
                          </div>
                          <button onClick={() => setIsRecentModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10">
                              <X size={20} />
                          </button>
                      </div>

                      {/* Toolbar / Search & Sorting */}
                      <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-[#1A1D21] shrink-0">
                          
                          {/* Search Bar */}
                          <div className="relative w-full md:w-72">
                              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                  type="text" 
                                  placeholder="Search recent uploads..." 
                                  value={modalSearchQuery}
                                  onChange={(e) => setModalSearchQuery(e.target.value)}
                                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                              />
                          </div>

                          {/* Sorting Buttons */}
                          <div className="flex items-center gap-1 bg-gray-50 dark:bg-black/20 p-1 rounded-xl border border-gray-200 dark:border-white/10 overflow-x-auto w-full md:w-auto">
                              <button 
                                  onClick={() => setSortConfig('newest')} 
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${sortConfig === 'newest' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                              >
                                  Newest
                              </button>
                              <button 
                                  onClick={() => setSortConfig('oldest')} 
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${sortConfig === 'oldest' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                              >
                                  Oldest
                              </button>
                              <button 
                                  onClick={() => setSortConfig('a-z')} 
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${sortConfig === 'a-z' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                              >
                                  A-Z
                              </button>
                              <button 
                                  onClick={() => setSortConfig('z-a')} 
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${sortConfig === 'z-a' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                              >
                                  Z-A
                              </button>
                          </div>
                      </div>

                      {/* GRID LIST */}
                      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/50 dark:bg-[#0B0D0F]/30">
                          {processedRecentUploads.length === 0 ? (
                              <div className="text-center py-20 flex flex-col items-center justify-center opacity-60">
                                  <Search size={40} className="mb-4 text-gray-400" />
                                  <p className="text-gray-500 text-lg font-medium">No results found.</p>
                              </div>
                          ) : (
                              // ✅ Updated to 3-Column Grid on large screens
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {processedRecentUploads.map(recent => (
                                      <div 
                                          key={recent.id} 
                                          className="flex items-center justify-between p-3 bg-white dark:bg-[#1A1D21] hover:bg-blue-50 dark:hover:bg-white/5 rounded-2xl transition-colors group border border-gray-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-white/10 cursor-pointer shadow-sm hover:shadow"
                                          onClick={() => { 
                                              setIsRecentModalOpen(false); 
                                              navigate(`/assets/${recent.id}`); 
                                          }}
                                      >
                                          <div className="flex items-center gap-4 min-w-0 flex-1">
                                              <div className="h-16 w-16 bg-gray-100 dark:bg-black/40 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-gray-200 dark:border-white/5 relative">
                                                  <AssetThumbnail 
                                                      mimeType={recent.mimeType} 
                                                      thumbnailPath={recent.thumbnailPath || recent.path} 
                                                      previewFrames={recent.previewFrames}
                                                      className="w-full h-full object-cover" 
                                                  />
                                              </div>
                                              <div className="min-w-0 pr-4">
                                                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={recent.originalName}>
                                                      {recent.originalName}
                                                  </p>
                                                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                                                      <span className="bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-md">{recent.mimeType.split('/')[1]}</span>
                                                      <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></span>
                                                      <span>{formatSafeDate(recent.createdAt)}</span>
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="shrink-0 p-2 rounded-full bg-white dark:bg-black/20 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                                              <ArrowRight size={16} className="text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-transform group-hover:translate-x-0.5" />
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