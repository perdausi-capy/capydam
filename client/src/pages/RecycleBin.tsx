import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { 
  Trash2, RotateCcw, AlertTriangle, ArrowLeft, Ban, Eraser, Check 
} from 'lucide-react';
import Masonry from 'react-masonry-css';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import ConfirmModal from '../components/ConfirmModal';

// ✅ Reusing your optimized card component
import AssetCard from '../components/AssetCard';

// --- TYPES ---
interface Asset {
  id: string;
  filename: string;
  thumbnailPath: string | null;
  mimeType: string;
  originalName: string;
  path: string;
  uploadedBy?: { name: string };
  aiData?: string;
  deletedAt?: string;
  isSkeleton?: boolean;
}

// --- CONSTANTS ---
const breakpointColumnsObj = { default: 4, 1536: 3, 1100: 2, 700: 1 };
const QUERY_LIMIT = 15;

// --- SKELETON ---
const SkeletonCard = () => (
  <div className="mb-6 break-inside-avoid w-full">
      <div className="w-full aspect-[3/4] bg-gray-200 dark:bg-white/5 rounded-2xl animate-pulse" />
      <div className="mt-3 space-y-2 px-1">
         <div className="h-4 w-3/4 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
      </div>
  </div>
);

// --- ⚡️ TRASH ITEM WRAPPER (Optimized) ---
const TrashGridItem = React.memo(({ 
    asset, 
    index, 
    onRestore, 
    onDeleteForever,
    isLast,
    lastAssetRef 
}: { 
    asset: Asset; 
    index: number; 
    onRestore: (id: string) => void;
    onDeleteForever: (id: string) => void;
    isLast: boolean;
    lastAssetRef: (node: HTMLDivElement) => void;
}) => {
    
    // Prevent clicking the card to go to details page (since it's deleted)
    const handleCardClick = (id: string) => {
        toast.info("Restore this asset to view details.");
    };

    return (
        <div 
            ref={isLast ? lastAssetRef : null} 
            className="relative group mb-6 break-inside-avoid"
        >
            {/* 1. We pass 'undefined' for download/collection so those buttons are HIDDEN.
               2. We intercept onClick to prevent navigation.
            */}
            <AssetCard 
                asset={asset} 
                index={index} 
                onClick={handleCardClick}
            />

            {/* 🔴 TRASH ACTIONS OVERLAY */}
            <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 pointer-events-none">
                
                {/* Restore Button */}
                <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRestore(asset.id); }}
                    className="pointer-events-auto p-3 rounded-full bg-green-500 text-white shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all hover:bg-green-600 hover:scale-110"
                    title="Restore Asset"
                >
                    <RotateCcw size={20} />
                </button>

                {/* Delete Forever Button */}
                <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteForever(asset.id); }}
                    className="pointer-events-auto p-3 rounded-full bg-red-600 text-white shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all hover:bg-red-700 hover:scale-110"
                    title="Permanently Delete"
                >
                    <Trash2 size={20} />
                </button>
            </div>

            {/* Red Tint to visually indicate 'Trash' state */}
            <div className="absolute inset-0 bg-red-500/10 dark:bg-red-900/20 rounded-2xl pointer-events-none border-2 border-transparent group-hover:border-red-500/30 transition-colors z-20" />
        </div>
    );
}, (prev, next) => prev.asset.id === next.asset.id && prev.isLast === next.isLast);


// --- MAIN PAGE COMPONENT ---
const RecycleBin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Modal States
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const observerInstance = useRef<IntersectionObserver | null>(null);

  // --- 🔒 ACCESS CONTROL ---
  if (!user || user.role !== 'admin') {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FC] dark:bg-[#0B0D0F] text-center px-4">
              <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 mb-4"><Ban size={40} /></div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
              <p className="text-gray-500 dark:text-gray-400 mb-6">This area is restricted to administrators only.</p>
              <button onClick={() => navigate('/')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Go Home</button>
          </div>
      );
  }

  // --- 1. DATA FETCHING ---
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch
  } = useInfiniteQuery({
    queryKey: ['recycle-bin'],
    queryFn: async ({ pageParam = 1 }) => {
        // ✅ Ensure your backend has this route, or use /assets?deleted=true
        const res = await client.get(`/assets/trash`, { 
            params: { page: pageParam, limit: QUERY_LIMIT } 
        });
        const results = res.data.results || res.data || [];
        const nextPage = results.length === QUERY_LIMIT ? (pageParam as number) + 1 : undefined;
        return { results, nextPage };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    staleTime: 0, // Always fetch fresh data for trash
  });

  const assets = useMemo(() => {
      const real = data?.pages.flatMap(p => p.results) || [];
      return isFetchingNextPage 
        ? [...real, ...Array.from({ length: 4 }).map((_, i) => ({ id: `skel-${i}`, isSkeleton: true } as Asset))] 
        : real;
  }, [data, isFetchingNextPage]);

  // --- 2. SCROLL OBSERVER ---
  const lastAssetRef = useCallback((node: HTMLDivElement) => {
    if (isLoading || isFetchingNextPage) return;
    if (observerInstance.current) observerInstance.current.disconnect();
    
    observerInstance.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) fetchNextPage();
    }, { rootMargin: '400px' });
    
    if (node) observerInstance.current.observe(node);
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  // --- 3. ACTIONS ---

  const handleRestore = async () => {
      if (!restoreId) return;
      try {
          await client.post(`/assets/${restoreId}/restore`);
          toast.success("Asset restored successfully");
          // Optimistic Update: Remove form list immediately
          queryClient.setQueryData(['recycle-bin'], (old: any) => {
              if (!old) return old;
              return { ...old, pages: old.pages.map((p: any) => ({ ...p, results: p.results.filter((a: Asset) => a.id !== restoreId) })) };
          });
      } catch (err) {
          toast.error("Failed to restore asset");
      } finally {
          setRestoreId(null);
      }
  };

  const handleDeleteForever = async () => {
      if (!deleteId) return;
      try {
          // ✅ Force delete endpoint
          await client.delete(`/assets/${deleteId}/force`); 
          toast.success("Permanently deleted");
          queryClient.setQueryData(['recycle-bin'], (old: any) => {
              if (!old) return old;
              return { ...old, pages: old.pages.map((p: any) => ({ ...p, results: p.results.filter((a: Asset) => a.id !== deleteId) })) };
          });
      } catch (err) {
          toast.error("Failed to delete asset");
      } finally {
          setDeleteId(null);
      }
  };

  const handleEmptyTrash = async () => {
      if (!window.confirm("Are you sure you want to empty the recycle bin? This cannot be undone.")) return;
      try {
          await client.delete(`/assets/trash/empty`);
          toast.success("Recycle bin emptied");
          refetch();
      } catch (err) {
          toast.error("Failed to empty trash");
      }
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] pb-20 transition-colors duration-500">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-[#1A1D21] border-b border-gray-200 dark:border-white/5 px-6 py-4 md:px-10 sticky top-0 z-20">
          <div className="mx-auto max-w-7xl">
            <button onClick={() => navigate(-1)} className="group mb-4 flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600">
                <div className="mr-2 rounded-full p-1 group-hover:bg-blue-50 dark:group-hover:bg-white/10"><ArrowLeft size={16} /></div> Back
            </button>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
                        <Trash2 size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recycle Bin</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage deleted assets. Items here are hidden from standard users.</p>
                    </div>
                </div>
                {assets.length > 0 && (
                     <button onClick={handleEmptyTrash} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md">
                        <Eraser size={16} /> Empty Trash
                     </button>
                )}
            </div>
          </div>
      </div>

      {/* CONTENT GRID */}
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        {assets.length === 0 && !isLoading ? (
            <div className="mt-20 flex flex-col items-center justify-center p-16 text-center opacity-60">
                <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-full mb-4">
                    <Check size={40} className="text-green-500" />
                </div>
                <h3 className="text-xl font-bold dark:text-white">Trash is Empty</h3>
                <p className="text-gray-500 mt-2">Everything looks clean here!</p>
            </div>
        ) : (
            <div className="w-full">
                <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
                    {assets.map((asset, index) => {
                        if (asset.isSkeleton) return <SkeletonCard key={asset.id} />;
                        
                        return (
                            <TrashGridItem 
                                key={asset.id}
                                asset={asset as Asset}
                                index={index}
                                onRestore={() => setRestoreId(asset.id)}
                                onDeleteForever={() => setDeleteId(asset.id)}
                                isLast={index === assets.length - 1}
                                lastAssetRef={lastAssetRef}
                            />
                        );
                    })}
                </Masonry>
            </div>
        )}
      </div>

      {/* MODALS */}
      <ConfirmModal 
        isOpen={!!restoreId} 
        onClose={() => setRestoreId(null)} 
        onConfirm={handleRestore} 
        title="Restore Asset" 
        message="This asset will be moved back to the library and visible to all users." 
        confirmText="Restore" 
        confirmColor="bg-green-600 hover:bg-green-700"
      />

      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={handleDeleteForever} 
        title="Permanently Delete" 
        message="Are you sure? This action CANNOT be undone. The file will be erased from the server." 
        confirmText="Delete Forever" 
        isDangerous={true} 
      />
    </div>
  );
};

export default RecycleBin;