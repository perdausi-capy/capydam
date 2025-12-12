import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  UploadCloud, 
  Settings, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music,
  Trash2,
  Sparkles,
  Link as LinkIcon,
  Edit2,
  Clock,
  ArrowRight,
  Check,
  X,
  Loader2 
} from 'lucide-react';
import client from '../api/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';

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
}

const Upload = () => {
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false); 
  const [recentUploads, setRecentUploads] = useState<RecentAsset[]>([]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [creativity, setCreativity] = useState(0.2);
  const [specificity, setSpecificity] = useState<'general' | 'high'>('general');

  // --- CALCULATE OVERALL PROGRESS ---
  const overallProgress = queue.length > 0 
    ? Math.min(100, Math.max(0, Math.round(queue.reduce((acc, item) => acc + item.progress, 0) / queue.length)))
    : 0;

  // --- FETCH HISTORY ---
  const fetchRecent = async () => {
    try {
      const res = await client.get('/assets?limit=5');
      const results = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setRecentUploads(results.slice(0, 5));
    } catch (error) { console.warn("Could not fetch history"); }
  };

  useEffect(() => { fetchRecent(); }, []);

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
    // ✅ REMOVED 'application/pdf'
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-[#0B0D0F] dark:via-[#131619] dark:to-[#0F0B15] pb-20 transition-colors duration-500">
      
      {/* Inject Custom Animation Styles */}
      <style>{customStyles}</style>

      <div className="max-w-6xl mx-auto px-4 py-8">
        
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
                      {/* ✅ UPDATED TEXT */}
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
                                  <div className="h-20 w-20 shrink-0 bg-gray-100 dark:bg-black/20 rounded-xl overflow-hidden border border-gray-100 dark:border-white/5 flex items-center justify-center">
                                      {item.file.preview ? <img src={item.file.preview} className="h-full w-full object-cover" alt="" /> : getFileIcon(item.file.type)}
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

              {/* RECENT HISTORY */}
              {recentUploads.length > 0 && (
                  <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1D21] p-6 shadow-sm animate-in fade-in slide-in-from-right-4 duration-700">
                      <div className="flex items-center gap-2 mb-4 text-gray-800 dark:text-white">
                          <Clock size={18} className="text-gray-500" />
                          <h3 className="font-bold text-sm">Recent Uploads</h3>
                      </div>
                      <div className="space-y-3">
                          {recentUploads.map(recent => (
                              <div key={recent.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer group" onClick={() => navigate(`/assets/${recent.id}`)}>
                                  <div className="h-8 w-8 bg-gray-100 dark:bg-white/10 rounded-lg flex items-center justify-center shrink-0 border border-gray-200 dark:border-white/5">{getFileIcon(recent.mimeType)}</div>
                                  <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate group-hover:text-indigo-600 transition-colors">{recent.originalName}</p>
                                      <p className="text-[10px] text-gray-400">{new Date(recent.createdAt).toLocaleDateString()}</p>
                                  </div>
                                  <ArrowRight size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                          ))}
                      </div>
                  </div>
              )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;