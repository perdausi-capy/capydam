import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { 
  ArrowLeft, Share2, MoreHorizontal, 
  Image as ImageIcon, Layout, Edit2, Check, X, Trash2
} from 'lucide-react';
import Masonry from 'react-masonry-css';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // ✅ Removed useInfiniteQuery

import AssetCard from '../components/AssetCard';

// --- TYPES ---
interface Asset {
  id: string;
  filename: string;
  thumbnailPath: string | null;
  mimeType: string; 
  originalName: string;
  uploadedBy?: { name: string };
  aiData?: string;
  createdAt?: string; 
  path: string;
  size?: number;
  previewFrames?: string[];
  isSkeleton?: boolean; 
}

interface CategoryData {
  id: string;
  name: string;
  group: string;
  assets: Asset[]; // ✅ The backend returns the array here
}

// --- CONSTANTS ---
const breakpointColumnsObj = { default: 4, 1536: 3, 1100: 2, 700: 1 };
const CHUNK_SIZE = 15; // ✅ Limit visible items per scroll

// --- SKELETON ---
const SkeletonCard = () => (
  <div className="mb-6 break-inside-avoid w-full">
      <div className="w-full aspect-[3/4] bg-gray-200 dark:bg-white/5 rounded-2xl animate-pulse" />
      <div className="mt-3 space-y-2 px-1">
         <div className="h-4 w-3/4 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
      </div>
  </div>
);

// --- ⚡️ OPTIMIZED ITEM WRAPPER ---
// Prevents re-renders of existing items when loading more
const AssetGridItem = React.memo(({ 
    asset, 
    index, 
    onDownload,
    isLast,
    lastAssetRef 
}: { 
    asset: Asset; 
    index: number; 
    onDownload: (e: React.MouseEvent, asset: any) => void;
    isLast: boolean;
    lastAssetRef: (node: HTMLDivElement) => void;
}) => {
    return (
        <div 
            ref={isLast ? lastAssetRef : null} 
            className="relative group mb-6 break-inside-avoid"
        >
            <AssetCard asset={asset} index={index} onDownload={onDownload} />
        </div>
    );
}, (prev, next) => prev.asset.id === next.asset.id && prev.isLast === next.isLast);

// --- MAIN COMPONENT ---
const CategoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // States
  const [assetToRemove, setAssetToRemove] = useState<string | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState("");

  // ✅ VISIBLE COUNT STATE (For Client-Side Pagination)
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);

  const observerInstance = useRef<IntersectionObserver | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const canCurate = user?.role === 'admin' || user?.role === 'editor';

  // --- 1. FETCH DATA (Get ONLY this category's assets) ---
  const { data: category, isLoading, isError } = useQuery<CategoryData>({
    queryKey: ['category', id],
    queryFn: async () => {
        // ✅ We use the specific ID endpoint to ensure we ONLY get this module's contents
        const { data } = await client.get(`/categories/${id}`);
        return data;
    },
    staleTime: 1000 * 60 * 5, 
  });

  useEffect(() => { if (category) setNewName(category.name); }, [category]);

  // --- 2. CALCULATE VISIBLE ASSETS ---
  // We take the full list from the API, but only return the first 'visibleCount' items to the renderer.
  const assets = useMemo(() => {
      if (!category?.assets) return [];
      return category.assets.slice(0, visibleCount);
  }, [category, visibleCount]);

  const hasMore = category?.assets ? visibleCount < category.assets.length : false;

  // --- 3. SCROLL TRIGGER ---
  // When user hits the bottom, we simply increase the visible count
  const lastAssetRef = useCallback((node: HTMLDivElement) => {
    if (isLoading) return;
    if (observerInstance.current) observerInstance.current.disconnect();
    
    observerInstance.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        // ✅ Reveal next batch
        setVisibleCount((prev) => prev + CHUNK_SIZE);
      }
    }, { rootMargin: '400px' });
    
    if (node) observerInstance.current.observe(node);
  }, [isLoading, hasMore]);


  // --- HANDLERS ---
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  };

  const handleRename = async () => {
    if (!newName.trim() || !category) return;
    try {
      await client.put(`/categories/${category.id}`, { name: newName });
      queryClient.setQueryData(['category', id], (old: any) => ({ ...old, name: newName }));
      setIsEditing(false);
      toast.success("Renamed");
    } catch { toast.error("Failed"); }
  };

  const handleDeleteCategory = async () => {
      try { await client.delete(`/categories/${id}`); navigate('/categories'); toast.success("Deleted"); }
      catch { toast.error("Failed"); }
  };

  const confirmRemoveAsset = async () => {
    if (!assetToRemove) return;
    try {
      await client.delete(`/categories/${id}/assets/${assetToRemove}`);
      // Optimistic update for local cache
      queryClient.setQueryData(['category', id], (old: any) => {
          if (!old) return old;
          return { ...old, assets: old.assets.filter((a: Asset) => a.id !== assetToRemove) };
      });
      toast.success('Removed from category');
    } catch { toast.error('Failed to remove'); } finally { setAssetToRemove(null); }
  };

  const handleDownload = useCallback(async (e: React.MouseEvent, asset: any) => {
    e.preventDefault(); e.stopPropagation();
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
        document.body.removeChild(link);
    } catch { toast.error('Download failed'); }
  }, []);

  // --- RENDER ---
  if (isLoading) {
      return (
        <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] pb-20">
            <div className="bg-white dark:bg-[#1A1D21] border-b border-gray-200 dark:border-white/5 px-6 py-4 sticky top-0 z-20">
                <div className="mx-auto max-w-7xl animate-pulse">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-white/5 rounded mb-4"></div>
                    <div className="h-8 w-64 bg-gray-200 dark:bg-white/5 rounded"></div>
                </div>
            </div>
            <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
                <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
                    {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
                </Masonry>
            </div>
        </div>
      );
  }

  if (isError || !category) return <div className="text-center mt-20 dark:text-white">Category Not Found</div>;

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] pb-20 transition-colors duration-500">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-[#1A1D21] border-b border-gray-200 dark:border-white/5 px-6 py-4 md:px-10 sticky top-0 z-20">
          <div className="mx-auto max-w-7xl">
            <button onClick={() => navigate('/categories')} className="group mb-4 flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600">
                <div className="mr-2 rounded-full p-1 group-hover:bg-blue-50 dark:group-hover:bg-white/10"><ArrowLeft size={16} /></div> Back
            </button>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div className="flex items-start gap-5 w-full">
                    <div className="hidden md:flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800/30 text-purple-600 dark:text-purple-400 shadow-sm">
                        <Layout size={32} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 h-9">
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 px-2 rounded-lg border border-gray-300 dark:bg-black/20 text-xl font-bold dark:text-white" autoFocus />
                                    <button onClick={handleRename} className="p-1.5 rounded-full bg-green-100 text-green-600"><Check size={18}/></button>
                                    <button onClick={() => setIsEditing(false)} className="p-1.5 rounded-full bg-red-100 text-red-600"><X size={18}/></button>
                                </div>
                            ) : (
                                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{category.name}</h1>
                            )}
                        </div>
                        {/* Show Total Count from full data, even if only partial shown */}
                        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><ImageIcon size={14} /> {category.assets.length} items</div>
                    </div>
                </div>

                <div className="flex items-center gap-3 relative">
                    <button onClick={handleShare} className="flex items-center gap-2 rounded-lg border dark:border-white/10 px-4 py-2 text-sm font-medium dark:text-gray-200"><Share2 size={16} /> Share</button>
                    {canCurate && (
                        <div ref={menuRef} className="relative">
                            <button onClick={() => setShowMenu(!showMenu)} className="p-2 border rounded-lg dark:border-white/10 dark:text-gray-400"><MoreHorizontal size={20} /></button>
                            {showMenu && (
                                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-[#1A1D21] border shadow-lg z-50 p-1">
                                    <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="flex w-full gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 dark:text-gray-200"><Edit2 size={16} /> Rename</button>
                                    <button onClick={() => { setIsDeletingCategory(true); setShowMenu(false); }} className="flex w-full gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 size={16} /> Delete</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
          </div>
      </div>

      {/* CONTENT GRID */}
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        {assets.length === 0 ? (
            <div className="mt-10 flex flex-col items-center justify-center p-16 text-center opacity-60">
                <Layout size={32} className="mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold dark:text-white">Empty Topic</h3>
                <p className="text-sm text-gray-500">No assets have been added to this module yet.</p>
            </div>
        ) : (
            <div className="w-full overflow-hidden">
                <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
                    {assets.map((asset, index) => (
                        <AssetGridItem 
                            key={asset.id}
                            asset={asset as Asset}
                            index={index}
                            onDownload={handleDownload}
                            isLast={index === assets.length - 1}
                            lastAssetRef={lastAssetRef}
                        />
                    ))}
                </Masonry>
                {/* Optional: Show loading skeletons at bottom if simulated loading */}
                {hasMore && (
                   <div className="py-4 text-center opacity-50 text-sm">Loading more...</div>
                )}
            </div>
        )}
      </div>

      <ConfirmModal isOpen={!!assetToRemove} onClose={() => setAssetToRemove(null)} onConfirm={confirmRemoveAsset} title="Remove Asset" message="Remove from category?" confirmText="Remove" isDangerous={true} />
      <ConfirmModal isOpen={isDeletingCategory} onClose={() => setIsDeletingCategory(false)} onConfirm={handleDeleteCategory} title="Delete Category" message="Delete this category?" confirmText="Delete" isDangerous={true} />
    </div>
  );
};

export default CategoryDetail;