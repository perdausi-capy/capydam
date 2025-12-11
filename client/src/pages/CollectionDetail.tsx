import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { 
    ArrowLeft, 
    Trash2, 
    Loader2, 
    FolderOpen, 
    Folder, 
    Share2,
    Calendar,
    Image as ImageIcon,
    Plus,
    X,
    FolderPlus, 
    Download,
    MoreHorizontal
} from 'lucide-react';
import Masonry from 'react-masonry-css';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from 'react-toastify';
import AssetThumbnail from '../components/AssetThumbnail'; 
import { useAuth } from '../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

interface Asset {
  id: string;
  filename: string;
  thumbnailPath: string | null;
  mimeType: string; 
  originalName: string;
  uploadedBy: { name: string };
  aiData?: string;
  createdAt?: string; 
  path: string;
  size?: number;
}

interface SubCollection {
  id: string;
  name: string;
  _count: { assets: number };
}

interface CollectionData {
  id: string;
  name: string;
  assets: Asset[];
  children: SubCollection[];
  createdAt?: string;
}

const cleanFilename = (name: string) => name.replace(/\.[^/.]+$/, "");
const formatBytes = (bytes?: number) => bytes ? (bytes/1024/1024).toFixed(2) + ' MB' : '0B';

const CollectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient(); 
  
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [assetToRemove, setAssetToRemove] = useState<string | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null); 

  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'editor'; 

  const fetchCollection = async () => {
    // ✅ FIX: Force loading state immediately when fetching starts
    // This ensures when you click a sub-folder, the spinner appears instantly.
    setLoading(true);
    
    try {
      const { data } = await client.get(`/collections/${id}`);
      setCollection(data);
    } catch (error) {
      toast.error("Failed to load collection");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollection();
  }, [id]);

  const handleCreateSubFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    
    setCreatingFolder(true);
    try {
        await client.post('/collections', {
            name: newFolderName,
            parentId: id 
        });
        toast.success(`Folder "${newFolderName}" created`);
        setIsCreateFolderOpen(false);
        setNewFolderName('');
        fetchCollection(); 
    } catch (error) {
        toast.error("Failed to create folder");
    } finally {
        setCreatingFolder(false);
    }
  };

  const handleRemoveClick = (e: React.MouseEvent, assetId: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    setAssetToRemove(assetId);
  };

  const confirmRemove = async () => {
    if (!assetToRemove) return;
    try {
      await client.delete(`/collections/${id}/assets/${assetToRemove}`);
      setCollection(prev => prev ? ({ ...prev, assets: prev.assets.filter(a => a.id !== assetToRemove) }) : null);
      toast.success('Removed from collection');
    } catch (error) { toast.error('Failed to remove asset'); } 
    finally { setAssetToRemove(null); }
  };

  const handleDownload = async (asset: Asset) => {
    try {
      toast.info('Downloading...', { autoClose: 1000 });
      const response = await fetch(asset.path);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = asset.originalName;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) { toast.error('Download failed'); }
  };

  const toggleDropdown = (e: React.MouseEvent, assetId: string) => {
    e.preventDefault(); e.stopPropagation();
    setActiveDropdownId(activeDropdownId === assetId ? null : assetId);
  };

  const addToSubCollection = async (e: React.MouseEvent, targetId: string, targetName: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!activeDropdownId) return;

    try {
      await client.post(`/collections/${targetId}/assets`, { assetId: activeDropdownId });
      toast.success(`Moved to ${targetName}`);
      setActiveDropdownId(null);
      fetchCollection(); // Refresh data
    } catch (error) {
      toast.info('Asset is likely already in this folder');
      setActiveDropdownId(null);
    }
  };

  const breakpointColumnsObj = { default: 5, 1536: 4, 1280: 3, 1024: 3, 768: 2, 640: 1 };

  // Loading State
  if (loading) return (
      <div className="flex h-screen items-center justify-center dark:bg-[#0B0D0F]">
          <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={40} />
      </div>
  );

  // 404 State
  if (!collection) return (
      <div className="flex h-screen flex-col items-center justify-center text-center dark:bg-[#0B0D0F] dark:text-white">
          <div className="rounded-full bg-red-50 dark:bg-red-900/20 p-4 text-red-500 mb-4"><FolderOpen size={32}/></div>
          <h2 className="text-xl font-bold">Collection Not Found</h2>
          <button onClick={() => navigate('/collections')} className="mt-4 text-blue-600 dark:text-blue-400 font-medium hover:underline">Back to Collections</button>
      </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] pb-20 transition-colors duration-500">
      
      {activeDropdownId && <div className="fixed inset-0 z-40 cursor-default" onClick={() => setActiveDropdownId(null)} />}

      {/* HERO HEADER */}
      <div className="bg-white/80 dark:bg-[#1A1D21]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 px-6 py-8 md:px-10 sticky top-0 z-20 transition-colors">
          <div className="mx-auto max-w-7xl">
            <button 
                onClick={() => navigate(-1)}
                className="group mb-6 flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
                <div className="mr-2 rounded-full p-1 group-hover:bg-blue-50 dark:group-hover:bg-white/10 transition-colors">
                    <ArrowLeft size={16} />
                </div>
                Back
            </button>

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div className="flex items-start gap-5">
                    <div className="hidden md:flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 shadow-sm">
                        <FolderOpen size={40} strokeWidth={1.5} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{collection.name}</h1>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1.5"><ImageIcon size={14} /> {collection.assets.length} items</span>
                            {collection.createdAt && <span className="flex items-center gap-1.5"><Calendar size={14} /> Created {new Date(collection.createdAt).toLocaleDateString()}</span>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {canManage && (
                        <button 
                            onClick={() => setIsCreateFolderOpen(true)}
                            className="flex items-center gap-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2 text-sm font-bold shadow-sm hover:scale-105 transition-all"
                        >
                            <Plus size={16} /> New Folder
                        </button>
                    )}
                    <button className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-all">
                        <Share2 size={16} /> Share
                    </button>
                </div>
            </div>
          </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        
        {/* 1. FOLDERS GRID */}
        {collection.children && collection.children.length > 0 && (
            <div className="mb-10">
                <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Folders</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {collection.children.map(sub => (
                        <Link 
                            to={`/collections/${sub.id}`} 
                            key={sub.id}
                            className="group flex flex-col items-center justify-center p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1D21] hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all aspect-square"
                        >
                            <Folder size={40} className="text-blue-200 dark:text-blue-900 group-hover:text-blue-500 dark:group-hover:text-blue-400 fill-current transition-colors" />
                            <span className="mt-3 font-semibold text-gray-700 dark:text-gray-200 text-sm truncate w-full text-center">{sub.name}</span>
                            <span className="text-[10px] text-gray-400">{sub._count.assets} items</span>
                        </Link>
                    ))}
                </div>
            </div>
        )}

        {/* 2. ASSETS GRID */}
        {collection.assets.length === 0 && collection.children.length === 0 ? (
            <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 p-16 text-center">
                <div className="mb-4 rounded-full bg-blue-50 dark:bg-blue-900/20 p-4 text-blue-500 dark:text-blue-400">
                    <FolderOpen size={32} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Empty Collection</h3>
                <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
                    Add assets or create sub-folders to get started.
                </p>
            </div>
        ) : (
             <>
                 {collection.assets.length > 0 && <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Assets</h3>}
                 <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
                    {collection.assets.map((asset, index) => (
                        <div 
                            key={asset.id} 
                            // LAYOUT: Frameless Canvas Style
                            className={`group relative mb-8 block transition-all duration-300 
                                ${activeDropdownId === asset.id ? 'z-50' : 'z-0'}
                            `}
                            style={{ contentVisibility: 'auto', containIntrinsicSize: '300px' }} 
                        >
                            {/* Wrapper for Image */}
                            <div className={`
                                relative w-full rounded-2xl overflow-hidden transition-all duration-300
                                bg-gray-100 dark:bg-[#1A1D21] 
                                shadow-sm hover:shadow-md
                                ${activeDropdownId === asset.id ? 'ring-4 ring-blue-500/20' : ''}
                            `}>
                                <Link to={`/assets/${asset.id}`} className="block cursor-pointer">
                                    <div className="group-hover:opacity-95 transition-opacity">
                                        <AssetThumbnail mimeType={asset.mimeType} thumbnailPath={asset.thumbnailPath || asset.path} className="w-full h-auto block" />
                                    </div>
                                </Link>
                            </div>

                            {/* Floating Buttons */}
                            <div className={`absolute top-3 right-3 flex gap-2 transition-opacity duration-200 ${activeDropdownId === asset.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                
                                {canManage && (
                                    <div className="relative">
                                        <button onClick={(e) => toggleDropdown(e, asset.id)} className={`rounded-full p-2 shadow-sm backdrop-blur-md transition-colors ${activeDropdownId === asset.id ? 'bg-blue-600 text-white' : 'bg-white/90 dark:bg-black/60 text-gray-700 dark:text-gray-200 hover:bg-blue-600 hover:text-white'}`}>
                                            <FolderPlus size={16} />
                                        </button>
                                        
                                        {activeDropdownId === asset.id && (
                                            <div className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-xl bg-white dark:bg-[#1F2227] shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-100 cursor-default z-50">
                                                <div className="max-h-56 overflow-y-auto py-1 custom-scrollbar">
                                                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">Move to Folder</div>
                                                    {collection.children.length === 0 ? (
                                                        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">No sub-folders.</div>
                                                    ) : (
                                                        collection.children.map(sub => (
                                                            <button key={sub.id} onClick={(e) => addToSubCollection(e, sub.id, sub.name)} className="flex w-full items-center px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-white/5 hover:text-blue-700 dark:hover:text-blue-400 transition-colors cursor-pointer border-b border-gray-50 dark:border-white/5 last:border-0">
                                                                <Folder size={14} className="mr-2 text-gray-400 dark:text-gray-500" />
                                                                <span className="truncate font-medium">{sub.name}</span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                                <div className="border-t bg-gray-50 dark:bg-white/5 dark:border-white/5 p-2">
                                                    <button onClick={(e) => { e.preventDefault(); setIsCreateFolderOpen(true); }} className="flex w-full items-center justify-center rounded-lg px-2 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"><Plus size={14} className="mr-1" /> New Folder</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownload(asset); }} className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-md transition-colors hover:bg-blue-600 hover:text-white"><Download size={16} /></button>
                                
                                {canManage && (
                                    <button onClick={(e) => handleRemoveClick(e, asset.id)} className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-md transition-colors hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Clean Text Info (Outside Card) */}
                            <div className="mt-3 px-1">
                                <p className="truncate font-bold text-sm text-gray-800 dark:text-gray-100" title={asset.originalName}>{cleanFilename(asset.originalName)}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">{asset.mimeType.split('/')[1] || 'FILE'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </Masonry>
             </>
        )}
      </div>

      <ConfirmModal isOpen={!!assetToRemove} onClose={() => setAssetToRemove(null)} onConfirm={confirmRemove} title="Remove Asset" message="Remove from this collection?" confirmText="Remove" isDangerous={true} />
    </div>
  );
};

export default CollectionDetail;