import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, X, Loader2, Settings, Sliders, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import client from '../api/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

const Upload = () => {
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [creativity, setCreativity] = useState(0.2);
  const [specificity, setSpecificity] = useState('general');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Add new files to queue with 'pending' status
    const newItems = acceptedFiles.map(file => ({
      file,
      status: 'pending' as const
    }));
    setQueue(prev => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true, // <--- ENABLE MULTIPLE
  });

  const removeFile = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  };

  const startUpload = async () => {
    setIsProcessing(true);

    // Process files one by one (or Promise.all for parallel)
    // We map over the queue, but we need to update state as we go
    const newQueue = [...queue];

    for (let i = 0; i < newQueue.length; i++) {
      if (newQueue[i].status === 'success') continue; // Skip already uploaded

      // Update status to uploading
      newQueue[i].status = 'uploading';
      setQueue([...newQueue]);

      const formData = new FormData();
      formData.append('file', newQueue[i].file);
      formData.append('creativity', creativity.toString());
      formData.append('specificity', specificity);

      try {
        await client.post('/assets/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        newQueue[i].status = 'success';
        toast.success(`Uploaded ${newQueue[i].file.name}`);
      } catch (err: any) {
        console.error(err);
        newQueue[i].status = 'error';
        newQueue[i].errorMessage = err.response?.data?.message || 'Failed';
      }
      
      // Update UI after each file
      setQueue([...newQueue]);   
    }

    setIsProcessing(false);
    
    // Optional: If all success, redirect after 1 second
    if (newQueue.every(item => item.status === 'success')) {
      setTimeout(() => navigate('/'), 1000);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Upload Assets</h1>
      
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`flex h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center text-gray-500">
          <UploadCloud size={40} className="text-gray-400 mb-4" />
          <p className="font-medium">Drag & drop files here</p>
          <p className="text-sm text-gray-400 mt-1">Images, Video, PDF, Audio</p>
        </div>
      </div>

      {/* Settings Accordion (Same as before) */}
      <div className="mt-4 rounded-lg border bg-white p-4 shadow-sm">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="flex w-full items-center justify-between text-gray-700 hover:text-blue-600"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Settings size={18} />
            <span>AI Recognition Settings</span>
          </div>
          <Sliders size={16} className={showSettings ? "text-blue-500" : "text-gray-400"} />
        </button>

        {showSettings && (
          <div className="mt-4 space-y-6 border-t pt-4">
             {/* ... Copy/Paste the sliders from your previous file ... */}
             {/* Or I can re-include them if you need */}
             <div className="flex items-center justify-between">
                <span className="text-sm">Specificity: {specificity}</span>
                <div className="space-x-2">
                    <button onClick={() => setSpecificity('general')} className={`px-3 py-1 rounded border ${specificity === 'general' ? 'bg-blue-100 border-blue-500' : ''}`}>General</button>
                    <button onClick={() => setSpecificity('high')} className={`px-3 py-1 rounded border ${specificity === 'high' ? 'bg-blue-100 border-blue-500' : ''}`}>High</button>
                </div>
             </div>
             <div>
                <label className="block text-sm">Creativity: {creativity}</label>
                <input type="range" min="0" max="1" step="0.1" value={creativity} onChange={e => setCreativity(parseFloat(e.target.value))} className="w-full" />
             </div>
          </div>
        )}
      </div>

      {/* File Queue List */}
      {queue.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="font-bold text-gray-700">Upload Queue ({queue.length})</h3>
          
          {queue.map((item, index) => (
            <div key={index} className="flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-100 text-gray-500">
                  <FileText size={20} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{item.file.name}</p>
                  <p className="text-xs text-gray-500">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {item.status === 'pending' && <span className="text-xs text-gray-500">Ready</span>}
                {item.status === 'uploading' && <Loader2 size={18} className="animate-spin text-blue-500" />}
                {item.status === 'success' && <CheckCircle size={18} className="text-green-500" />}
                {item.status === 'error' && (
                    <div className="flex items-center text-red-500" title={item.errorMessage}>
                        <AlertCircle size={18} />
                    </div>
                )}
                
                {item.status !== 'uploading' && (
                  <button onClick={() => removeFile(index)} className="text-gray-400 hover:text-red-500">
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button 
              onClick={() => setQueue([])} 
              disabled={isProcessing}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              Clear All
            </button>
            <button
              onClick={startUpload}
              disabled={isProcessing || queue.every(i => i.status === 'success')}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Uploading...' : 'Start Upload'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;