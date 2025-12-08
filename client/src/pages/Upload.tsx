import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  UploadCloud, 
  X, 
  Loader2, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music,
  Trash2,
  Lightbulb,
  Layers,
  FileCheck,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import client from '../api/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

// ... (Keep your Interfaces: ExtendedFile, UploadItem, RecentAsset same as before) ...
interface ExtendedFile extends File { preview?: string; }
interface UploadItem { file: ExtendedFile; status: 'pending' | 'uploading' | 'success' | 'error'; errorMessage?: string; }
interface RecentAsset { id: string; originalName: string; mimeType: string; createdAt: string; }

const Upload = () => {
  // ... (Keep all your state and logic functions: onDrop, startUpload, etc. EXACTLY the same) ...
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const [creativity, setCreativity] = useState(0.2);
  const [specificity, setSpecificity] = useState<'general' | 'high'>('general');
  const [recentUploads, setRecentUploads] = useState<RecentAsset[]>([]);
  const [isRecentOpen, setIsRecentOpen] = useState(false);

  // ... (Paste your fetchRecent, onDrop, useEffects, removeFile, startUpload logic here) ...
  const fetchRecent = async () => { try { const res = await client.get('/assets'); if (Array.isArray(res.data)) { setRecentUploads(res.data.slice(0, 5)); } else if (res.data.results) { setRecentUploads(res.data.results.slice(0, 5)); } } catch (e) {} };
  useEffect(() => { fetchRecent(); }, []);
  const onDrop = useCallback((acceptedFiles: File[]) => { const newItems = acceptedFiles.map(file => ({ file: Object.assign(file, { preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined }), status: 'pending' as const })); setQueue(prev => [...prev, ...newItems]); }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true, accept: { 'image/*': [], 'video/*': [], 'application/pdf': [], 'audio/*': [] } });
  useEffect(() => { return () => queue.forEach(item => { if (item.file.preview) URL.revokeObjectURL(item.file.preview); }); }, [queue]);
  const removeFile = (index: number) => { setQueue(prev => prev.filter((_, i) => i !== index)); };
  const startUpload = async () => { setIsProcessing(true); const newQueue = [...queue]; for (let i = 0; i < newQueue.length; i++) { if (newQueue[i].status === 'success') continue; newQueue[i].status = 'uploading'; setQueue([...newQueue]); const formData = new FormData(); formData.append('file', newQueue[i].file); formData.append('creativity', creativity.toString()); formData.append('specificity', specificity); try { await client.post('/assets/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }); newQueue[i].status = 'success'; } catch (err: any) { newQueue[i].status = 'error'; newQueue[i].errorMessage = err.response?.data?.message || 'Failed'; toast.error(`Failed to upload ${newQueue[i].file.name}`); } setQueue([...newQueue]); } setIsProcessing(false); fetchRecent(); if (newQueue.every(item => item.status === 'success')) { toast.success('All files uploaded successfully!'); setTimeout(() => navigate('/'), 1500); } };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon size={20} className="text-purple-500" />;
    if (mimeType.startsWith('video/')) return <Film size={20} className="text-pink-500" />;
    if (mimeType.startsWith('audio/')) return <Music size={20} className="text-yellow-500" />;
    return <FileText size={20} className="text-blue-500" />;
  };

  return (
    // 1. GRADIENT BACKGROUND WRAPPER (Updated for Dark Mode)
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-[#0B0D0F] dark:via-[#131619] dark:to-[#0F0B15] pb-20 transition-colors duration-500">
      
      <div className="max-w-5xl mx-auto px-4 py-8">
        
        {/* HEADER */}
        <div className="mb-10 animate-in slide-in-from-top-4 duration-700 fade-in">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white dark:bg-white/5 rounded-2xl shadow-sm shadow-indigo-100 dark:shadow-none border border-indigo-50 dark:border-white/10">
                <UploadCloud className="text-indigo-600 dark:text-indigo-400" size={32} />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Upload Assets</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                   Add magic to your library <Sparkles size={14} className="text-yellow-400 fill-yellow-400 animate-pulse" />
                </p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
              
              {/* DROPZONE */}
              <div
                  {...getRootProps()}
                  className={`
                    relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-500 ease-out h-72 flex flex-col items-center justify-center text-center cursor-pointer group
                    ${isDragActive 
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 scale-[1.02] shadow-xl ring-4 ring-indigo-100 dark:ring-indigo-900/30' 
                      : 'border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-lg hover:-translate-y-1'
                    }
                  `}
              >
                  <input {...getInputProps()} />
                  
                  {/* Floating Background Blobs (Adjusted for Dark) */}
                  <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                     <div className="absolute top-[-20%] left-[-10%] w-40 h-40 bg-purple-200/30 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
                     <div className="absolute bottom-[-20%] right-[-10%] w-40 h-40 bg-blue-200/30 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-700"></div>
                  </div>

                  <div className="z-10 p-6 flex flex-col items-center">
                      <div className={`
                        mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm ring-8 ring-white dark:ring-white/5 transition-transform duration-500
                        ${isDragActive ? 'scale-110 rotate-12' : 'group-hover:scale-110 group-hover:-rotate-3'}
                      `}>
                          <UploadCloud size={36} strokeWidth={1.5} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Click or drag files here</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
                        Support for <span className="font-semibold text-indigo-600 dark:text-indigo-400">Images, Video, Audio & PDF</span> up to 50MB
                      </p>
                  </div>
              </div>

              {/* QUEUE LIST */}
              {queue.length > 0 && (
                  <div className="rounded-3xl border border-gray-100 dark:border-white/10 bg-white/80 dark:bg-[#1A1D21]/80 backdrop-blur-xl shadow-xl shadow-indigo-100/50 dark:shadow-none overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                      <div className="border-b border-gray-100 dark:border-white/10 bg-white/50 dark:bg-white/5 px-6 py-4 flex justify-between items-center">
                          <h3 className="font-bold text-gray-700 dark:text-gray-200">Ready to Upload <span className="ml-2 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-full text-xs">{queue.length}</span></h3>
                          <button 
                              onClick={() => setQueue([])}
                              disabled={isProcessing}
                              className="text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                              Clear All
                          </button>
                      </div>
                      
                      <div className="divide-y divide-gray-50 dark:divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar">
                          {queue.map((item, index) => (
                              <div key={index} className="group flex items-center gap-4 p-4 hover:bg-indigo-50/30 dark:hover:bg-white/5 transition-colors animate-in slide-in-from-bottom-2 duration-300 fill-mode-backwards" style={{animationDelay: `${index * 50}ms`}}>
                                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white dark:bg-white/10 border border-gray-100 dark:border-white/10 shadow-sm flex items-center justify-center">
                                      {item.file.preview ? (
                                          <img src={item.file.preview} alt="preview" className="h-full w-full object-cover" />
                                      ) : ( getFileIcon(item.file.type) )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-1">
                                          <p className="truncate text-sm font-bold text-gray-800 dark:text-gray-200">{item.file.name}</p>
                                          <div className="shrink-0">
                                            {item.status === 'pending' && <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded-full uppercase tracking-wide">Ready</span>}
                                            {item.status === 'uploading' && <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-full flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Uploading</span>}
                                            {item.status === 'success' && <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle size={10}/> Done</span>}
                                            {item.status === 'error' && <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-full">Failed</span>}
                                          </div>
                                      </div>
                                      <p className="text-xs text-gray-400">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                                  </div>
                                  <button onClick={() => removeFile(index)} disabled={item.status === 'uploading'} className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* --- RECENT ACTIVITY --- */}
              <div className="rounded-3xl border border-gray-200/60 dark:border-white/10 bg-white/60 dark:bg-[#1A1D21]/60 backdrop-blur-sm overflow-hidden">
                  <button onClick={() => setIsRecentOpen(!isRecentOpen)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/80 dark:hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
                          <div className="p-2 bg-white dark:bg-white/10 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                             <Clock size={16} className="text-indigo-500 dark:text-indigo-400" />
                          </div>
                          <span className="font-bold text-sm">Recent Uploads</span>
                      </div>
                      <div className={`transition-transform duration-300 ${isRecentOpen ? 'rotate-180' : ''}`}><ChevronDown size={18} className="text-gray-400" /></div>
                  </button>
                  <div className={`transition-[max-height] duration-500 ease-in-out overflow-hidden ${isRecentOpen ? 'max-h-96' : 'max-h-0'}`}>
                      <div className="p-2 space-y-1 bg-white/50 dark:bg-black/20">
                          {recentUploads.length === 0 ? <div className="p-6 text-center text-sm text-gray-400">No recent activity.</div> : recentUploads.map(asset => (
                              <div key={asset.id} className="flex items-center justify-between p-3 hover:bg-white dark:hover:bg-white/5 rounded-xl transition-all group">
                                  <div className="flex items-center gap-3 overflow-hidden">
                                      <div className="h-8 w-8 shrink-0 flex items-center justify-center bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5">{getFileIcon(asset.mimeType)}</div>
                                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{asset.originalName}</p>
                                  </div>
                                  <span className="text-xs text-gray-400 font-mono">{new Date(asset.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">

              {/* --- PRO TIPS --- */}
              <div className="rounded-3xl border border-blue-100 dark:border-blue-900/30 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 p-6 shadow-lg shadow-blue-100/50 dark:shadow-none">
                  <div className="flex items-center gap-3 mb-5 text-blue-900 dark:text-blue-100">
                      <div className="p-2 bg-white dark:bg-white/10 rounded-xl shadow-sm text-yellow-500"><Lightbulb size={20} className="fill-yellow-400" /></div>
                      <h3 className="font-bold text-base">Pro Tips</h3>
                  </div>
                  <ul className="space-y-4">
                      <li className="flex gap-3 text-sm text-blue-800/80 dark:text-blue-200/80 leading-snug">
                          <Layers size={18} className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                          <span>Drag entire <strong>folders</strong> to flatten them into a single upload queue.</span>
                      </li>
                      <li className="flex gap-3 text-sm text-blue-800/80 dark:text-blue-200/80 leading-snug">
                          <FileCheck size={18} className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                          <span>Use clear names like <code>demo.mp4</code> for better AI tagging.</span>
                      </li>
                  </ul>
              </div>
              
              {/* AI SETTINGS */}
              <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1D21] p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6 text-gray-800 dark:text-white">
                      <div className="p-2 bg-gray-50 dark:bg-white/5 rounded-xl"><Settings size={20} className="text-gray-600 dark:text-gray-300" /></div>
                      <h3 className="font-bold">AI Intelligence</h3>
                  </div>

                  <div className="space-y-6">
                      <div>
                          <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 block">Tagging Depth</label>
                          <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                              <button onClick={() => setSpecificity('general')} className={`py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${specificity === 'general' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-md ring-1 ring-gray-100 dark:ring-white/10' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>Standard</button>
                              <button onClick={() => setSpecificity('high')} className={`py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${specificity === 'high' ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-indigo-50 dark:ring-indigo-500/30' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>Deep Scan</button>
                          </div>
                      </div>

                      <div>
                          <div className="flex justify-between items-center mb-3">
                              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Creativity</label>
                              <span className="text-xs font-bold bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded-lg">{Math.round(creativity * 100)}%</span>
                          </div>
                          <input type="range" min="0" max="1" step="0.1" value={creativity} onChange={e => setCreativity(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-100 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                      </div>
                  </div>
              </div>

              {/* ACTION BUTTON */}
              <button
                  onClick={startUpload}
                  disabled={isProcessing || queue.length === 0 || queue.every(i => i.status === 'success')}
                  className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-500/20 transition-all duration-300 flex items-center justify-center gap-3 group
                      ${isProcessing || queue.length === 0 
                          ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed shadow-none' 
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:scale-[1.02] hover:shadow-indigo-500/30'
                      }`}
              >
                  {isProcessing ? <><Loader2 className="animate-spin" size={24} /> Processing...</> : <><span className="drop-shadow-sm">Start Upload</span> <UploadCloud size={24} className="group-hover:-translate-y-1 transition-transform" /></>}
              </button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;