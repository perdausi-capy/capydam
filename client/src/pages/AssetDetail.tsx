import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { 
    ArrowLeft, 
    Download, 
    Trash2, 
    Save, 
    FolderPlus,
    FileText,
    Sparkles, 
    ExternalLink,
    Cpu,
    HardDrive,
    Calendar,
    User, // <--- Icon for Topics
    Tag     // <--- Icon for Category Dropdown
} from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal';
import AssetThumbnail from '../components/AssetThumbnail';
import Masonry from 'react-masonry-css'; 
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext'; 

interface AssetData {
  id: string;
  filename: string; 
  mimeType: string;
  originalName: string;
  path: string; 
  thumbnailPath?: string; 
  aiData: string; 
  createdAt: string;
  size?: number; 
  uploadedBy: { name: string };
  userId: string;
}

interface Category {
  id: string;
  name: string;
  group: string;
}

const AssetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Data
  const [asset, setAsset] = useState<AssetData | null>(null);
  const [related, setRelated] = useState<any[]>([]); 
  const [collections, setCollections] = useState<{id: string, name: string}[]>([]);
  const [categories, setCategories] = useState<Category[]>([]); // <--- NEW: Categories State
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]); 
  const [newTag, setNewTag] = useState(''); 
  
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(''); // <--- NEW: Category Selection

  // Permissions
  // const isViewer = user?.role === 'viewer';
  const isAdmin = user?.role === 'admin';
  const isEditor = user?.role === 'editor';
  const isOwner = asset?.userId === user?.id;

  const canEdit = isAdmin || isEditor; 
  const canDelete = isAdmin || (isEditor && isOwner); 
  const canAddToCollection = isAdmin || isEditor;
  const canCurateTopic = isAdmin || isEditor; // Only Admins/Editors can organize global topics

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      setLoading(true); 
      try {
        // 1. Asset
        const { data } = await client.get(`/assets/${id}`);
        setAsset(data);
        setTitle(data.originalName || data.filename); 

        if (data.aiData) {
          try {
            const parsed = JSON.parse(data.aiData);
            setDescription(parsed.description || '');
            const loadedTags = parsed.tags 
                ? (Array.isArray(parsed.tags) ? parsed.tags : parsed.tags.split(',')) 
                : [];
            setTags(loadedTags.map((t: string) => t.trim()).filter(Boolean));
          } catch (e) { console.error(e); }
        }

        // 2. Related
        const relatedRes = await client.get(`/assets/${id}/related`);
        setRelated(relatedRes.data);

        // 3. Collections
        const colRes = await client.get('/collections'); 
        setCollections(colRes.data || []);

        // 4. Categories (Topics) <--- NEW
        const catRes = await client.get('/categories');
        setCategories(catRes.data || []);

      } catch (error) {
        toast.error("Asset not found");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  // --- ACTIONS ---

  const handleSave = async () => {
    if (!asset || !canEdit) return;
    setSaving(true);
    try {
      const existingColors = asset.aiData ? JSON.parse(asset.aiData).colors : [];
      const updatedAiData = {
        description,
        tags: tags,
        colors: existingColors
      };

      await client.patch(`/assets/${asset.id}`, {
        originalName: title, 
        aiData: updatedAiData
      });
      
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Changes saved successfully!');
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!asset || !canDelete) return;
    setDeleting(true);
    try {
      await client.delete(`/assets/${asset.id}`);
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset deleted permanently');
      navigate('/'); 
    } catch (error: any) {
      toast.error('Failed to delete asset');
      setDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const addToCollection = async () => {
    if (!selectedCollectionId || !canAddToCollection) return;
    try {
      await client.post(`/collections/${selectedCollectionId}/assets`, { assetId: id });
      await queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success('Added to collection!');
      setSelectedCollectionId('');
    } catch (error) {
      toast.info('Asset is likely already in this collection');
    }
  };

  // NEW: Add to Topic (Category)
  const addToCategory = async () => {
    if (!selectedCategoryId || !canCurateTopic) return;
    try {
      await client.post(`/categories/${selectedCategoryId}/assets`, { assetId: id });
      toast.success('Added to Topic!');
      setSelectedCategoryId('');
    } catch (error) {
      toast.info('Asset is likely already in this topic');
    }
  };

  const handleDownload = async () => {
    if (!asset) return;
    try {
      toast.info('Starting download...', { autoClose: 2000 });
      const response = await fetch(asset.path);
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = asset.originalName;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) { toast.error('Download failed'); }
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim() && canEdit) {
        e.preventDefault();
        if (!tags.includes(newTag.trim())) setTags([...tags, newTag.trim()]);
        setNewTag('');
    }
  };
  const removeTag = (tagToRemove: string) => {
      if (canEdit) setTags(tags.filter(t => t !== tagToRemove));
  };
  
  const formatBytes = (bytes?: number) => bytes ? (bytes/1024/1024).toFixed(2) + ' MB' : '0B';
  const breakpointColumnsObj = { default: 5, 1536: 4, 1280: 4, 1024: 3, 768: 2, 640: 2 };

  if (loading || !asset) return <div className="h-screen flex items-center justify-center dark:bg-[#0B0D0F] dark:text-white"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#0B0D0F] overflow-hidden transition-colors duration-300">
      
      {/* HEADER */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 dark:border-white/10 px-6 bg-white/80 dark:bg-[#1A1D21]/80 backdrop-blur-md shrink-0 z-20 shadow-sm sticky top-0 transition-colors">
         <div className="flex items-center gap-4 flex-1 min-w-0">
             <button onClick={() => navigate('/')} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-300 transition-colors" title="Back">
                 <ArrowLeft size={20} />
             </button>
             
             <div className="flex flex-col flex-1 max-w-2xl">
                 <input 
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!canEdit}
                    className={`text-lg font-bold text-gray-900 dark:text-white bg-transparent rounded px-2 -ml-2 truncate border-transparent border transition-colors outline-none
                        ${canEdit ? 'focus:bg-gray-50 dark:focus:bg-white/5 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 hover:border-gray-200 dark:hover:border-white/10' : 'cursor-default opacity-90'}
                    `}
                    placeholder="Asset Name"
                 />
             </div>
         </div>

         <div className="flex items-center gap-2">
             <button onClick={handleDownload} className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-full hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                 <Download size={16} /> <span className="hidden lg:inline">Download</span>
             </button>
             
             {canEdit && (
                 <button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 transition-all shadow-md"
                 >
                     {saving ? <><div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"/> Saving...</> : <><Save size={16}/> Save Changes</>}
                 </button>
             )}
         </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-[#0B0D0F]">
          <div className="mx-auto max-w-[1600px]">
            <div className="flex flex-col lg:flex-row min-h-[600px]">
                
                {/* LEFT: IMAGE STAGE */}
                <div className="flex-1 bg-gray-50/50 dark:bg-[#121417] p-8 lg:p-12 flex items-start justify-center transition-colors">
                    <div className="relative rounded-[32px] overflow-hidden shadow-2xl ring-1 ring-black/5 dark:ring-white/10 bg-checkerboard max-w-full">
                        {asset.mimeType.startsWith('image/') ? <img src={asset.path} alt={asset.originalName} className="max-h-[70vh] w-auto object-contain" /> 
                        : asset.mimeType.startsWith('video/') ? <video controls src={asset.path} className="max-h-[70vh] w-auto" /> 
                        : <div className="h-96 w-96 flex flex-col items-center justify-center bg-gray-50 dark:bg-white/5"><FileText size={64} className="text-gray-300 dark:text-gray-600 mb-4"/><span className="text-gray-500 dark:text-gray-400 font-medium">Preview Unavailable</span></div>}
                        <a href={asset.path} target="_blank" rel="noreferrer" className="absolute bottom-4 right-4 bg-white/90 dark:bg-black/80 p-2.5 rounded-full shadow-lg hover:scale-110 text-gray-700 dark:text-gray-200 backdrop-blur-sm transition-transform"><ExternalLink size={18}/></a>
                    </div>
                </div>

                {/* RIGHT: METADATA SIDEBAR */}
                <div className="w-full lg:w-[450px] border-l border-gray-100 dark:border-white/5 bg-white dark:bg-[#1A1D21] p-8 space-y-8 h-auto lg:min-h-screen transition-colors">
                    
                    {/* Description */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Description</h3>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={!canEdit}
                            rows={4}
                            className={`w-full rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 p-4 text-sm text-gray-700 dark:text-gray-200 outline-none resize-none transition-all
                                ${canEdit ? 'focus:border-blue-500 dark:focus:border-blue-500 focus:ring-blue-500' : 'cursor-default opacity-80'}
                            `}
                            placeholder={canEdit ? "Add a detailed description..." : "No description provided."}
                        />
                    </div>

                    {/* Tags */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                            {tags.map((tag, idx) => (
                                <span key={idx} className="group inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition-colors cursor-default border border-transparent dark:border-white/5">
                                    #{tag}
                                    {canEdit && (
                                        <button onClick={() => removeTag(tag)} className="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                    )}
                                </span>
                            ))}
                            {canEdit && (
                                <input 
                                    type="text" 
                                    value={newTag}
                                    onChange={e => setNewTag(e.target.value)}
                                    onKeyDown={addTag}
                                    placeholder="+ Add tag"
                                    className="inline-flex px-3 py-1 text-xs bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none placeholder-gray-400 dark:placeholder-gray-600 text-gray-700 dark:text-gray-200 min-w-[60px]"
                                />
                            )}
                        </div>
                    </div>

                    {/* File Details */}
                    <div className="bg-gray-50/50 dark:bg-white/5 rounded-2xl p-5 border border-gray-100 dark:border-white/5">
                        <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">File Details</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-2"><Cpu size={14}/> File Type</span>
                                <span className="font-medium uppercase text-gray-900 dark:text-gray-200">{asset.mimeType.split('/')[1]}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-2"><HardDrive size={14}/> Size</span>
                                <span className="font-medium text-gray-900 dark:text-gray-200">{formatBytes(asset.size)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-2"><Calendar size={14}/> Created</span>
                                <span className="font-medium text-gray-900 dark:text-gray-200">{new Date(asset.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-white/10 mt-2">
                                <span className="flex items-center gap-2"><User size={14}/> Uploaded By</span>
                                <span className="font-medium text-gray-900 dark:text-gray-200">{asset.uploadedBy.name}</span>
                            </div>
                        </div>
                    </div>

                    {/* SAVE TO COLLECTION */}
                    {canAddToCollection && (
                        <div className="pt-6 border-t border-gray-100 dark:border-white/10">
                            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Save to Collection</h3>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <select 
                                        className="w-full appearance-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 py-2.5 pl-4 pr-10 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition-all"
                                        value={selectedCollectionId}
                                        onChange={(e) => setSelectedCollectionId(e.target.value)}
                                    >
                                        <option value="" className="text-gray-400">Select collection...</option>
                                        {collections.map(c => <option key={c.id} value={c.id} className="text-gray-900 dark:text-gray-200">{c.name}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                                        <FolderPlus size={16} />
                                    </div>
                                </div>
                                <button onClick={addToCollection} className="bg-gray-900 dark:bg-white dark:text-black text-white px-5 rounded-xl font-bold text-sm hover:bg-black dark:hover:bg-gray-200 transition-colors shadow-sm">
                                    Add
                                </button>
                            </div>
                        </div>
                    )}

                    {/* NEW: ADD TO TOPIC (For Admins/Editors) */}
                    {canCurateTopic && (
                        <div className="pt-4">
                            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Categorize Topic</h3>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <select 
                                        className="w-full appearance-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 py-2.5 pl-4 pr-10 text-sm text-gray-700 dark:text-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30 outline-none transition-all"
                                        value={selectedCategoryId}
                                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                                    >
                                        <option value="" className="text-gray-400">Select Topic...</option>
                                        <optgroup label="Feature Modules">
                                            {categories.filter(c => c.group === 'Features').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </optgroup>
                                        <optgroup label="Design Inspiration">
                                            {categories.filter(c => c.group === 'Inspiration').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </optgroup>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                                        <Tag size={16} />
                                    </div>
                                </div>
                                <button onClick={addToCategory} className="bg-purple-600 text-white px-5 rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors shadow-sm">
                                    Save
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Delete */}
                    {canDelete && (
                        <div className="pt-6 border-t border-gray-100 dark:border-white/10">
                            <button onClick={() => setIsDeleteModalOpen(true)} className="w-full py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 font-medium text-sm hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 hover:border-red-200 dark:hover:border-red-800 transition-all flex items-center justify-center gap-2">
                                <Trash2 size={16} /> Delete Asset
                            </button>
                        </div>
                    )}

                </div>
            </div>

            {/* RELATED */}
            {related.length > 0 && (
                <div className="border-t border-gray-100 dark:border-white/10 bg-white dark:bg-[#1A1D21] px-6 py-12 md:px-12 transition-colors">
                    <h2 className="text-center text-xl font-bold text-gray-900 dark:text-white mb-8 flex items-center justify-center gap-2">
                        <Sparkles size={20} className="text-yellow-400 fill-yellow-400" /> More like this
                    </h2>
                    <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
                        {related.map((item) => (
                            <div key={item.id} className="mb-6 break-inside-avoid rounded-2xl overflow-hidden cursor-pointer group relative shadow-sm border border-gray-100 dark:border-white/5 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300" onClick={() => { navigate(`/assets/${item.id}`); window.scrollTo(0, 0); }}>
                                <div className="relative bg-gray-50 dark:bg-white/5 overflow-hidden">
                                    <AssetThumbnail mimeType={item.mimeType} thumbnailPath={item.thumbnailPath || item.path} className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                                </div>
                                <div className="p-3 bg-white dark:bg-[#1A1D21]">
                                   <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{item.originalName}</p>
                                </div>
                            </div>
                        ))}
                    </Masonry>
                </div>
            )}
          </div>
      </div>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Asset"
        message="Are you sure? This action cannot be undone."
        confirmText="Yes, Delete"
        isDangerous={true}
        isLoading={deleting}
      />
    </div>
  );
};

export default AssetDetail;