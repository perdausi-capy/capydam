import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { 
  Trash2, RotateCcw, AlertTriangle, ArrowLeft, Ban, Eraser, 
  Check, Clock, Search, Loader2, ScanLine
} from 'lucide-react';
import Masonry from 'react-masonry-css';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import ConfirmModal from '../components/ConfirmModal';
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
  deletedAt?: string; // Essential for "Days Left" calc
  isSkeleton?: boolean;
}

// --- CONSTANTS ---
const breakpointColumnsObj = { default: 4, 1536: 3, 1100: 2, 700: 1 };
const QUERY_LIMIT = 15;
const AUTO_DELETE_DAYS = 30;

// --- ⚡️ COMPONENTS ---

// 1. SCANNING LOADER (New Design)
const ScanningLoader = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in duration-700">
        <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full animate-pulse"></div>
            <div className="relative bg-white dark:bg-[#1A1D21] p-6 rounded-3xl shadow-2xl border border-gray-100 dark:border-white/5">
                <ScanLine size={48} className="text-red-500 animate-pulse" />
            </div>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Scanning Debris...</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto">
            Locating deleted assets and calculating expiration dates.
        </p>
    </div>
);

// 2. TIME REMAINING BADGE
const DaysLeftBadge = ({ deletedAt }: { deletedAt?: string }) => {
    if (!deletedAt) return null;
    
    const deleteDate = new Date(deletedAt);
    const expirationDate = new Date(deleteDate.getTime() + (AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000));
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Logic: If negative, it's about to happen today
    const daysLeft = diffDays > 0 ? diffDays : 0;
    
    let colorClass = "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300";
    if (daysLeft <= 3) colorClass = "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse";
    else if (daysLeft <= 7) colorClass = "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400";

    return (
        <div className={`absolute top-3 left-3 z-20 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md flex items-center gap-1.5 ${colorClass}`}>
            <Clock size={10} />
            {daysLeft === 0 ? "Deleting Today" : `${daysLeft} Days Left`}
        </div>
    );
};

// 3. TRASH GRID ITEM
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
    
    const handleCardClick = () => {
        toast.info("Restore this asset to view details.");
    };

    return (
        <div 
            ref={isLast ? lastAssetRef : null} 
            className="relative group mb-6 break-inside-avoid"
        >
            <DaysLeftBadge deletedAt={asset.deletedAt} />
            
            <div className="opacity-75 group-hover:opacity-100 transition-opacity duration-300 grayscale group-hover:grayscale-0">
                <AssetCard 
                    asset={asset} 
                    index={index} 
                    onClick={handleCardClick}
                />
            </div>

            {/* ACTION OVERLAY */}
            <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-all duration-300 z-30 pointer-events-none translate-y-2 group-hover:translate-y-0">
                <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRestore(asset.id); }}
                    className="pointer-events-auto p-3.5 rounded-2xl bg-white dark:bg-[#1A1D21] text-green-600 dark:text-green-500 shadow-xl border border-gray-100 dark:border-white/10 hover:scale-110 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
                    title="Restore Asset"
                >
                    <RotateCcw size={22} strokeWidth={2.5} />
                </button>

                <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteForever(asset.id); }}
                    className="pointer-events-auto p-3.5 rounded-2xl bg-white dark:bg-[#1A1D21] text-red-600 dark:text-red-500 shadow-xl border border-gray-100 dark:border-white/10 hover:scale-110 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    title="Permanently Delete"
                >
                    <Trash2 size={22} strokeWidth={2.5} />
                </button>
            </div>

            {/* DANGER TINT */}
            <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/5 dark:group-hover:bg-red-500/10 rounded-2xl pointer-events-none border-2 border-transparent group-hover:border-red-500/20 transition-all duration-300 z-20" />
        </div>
    );
}, (prev, next) => prev.asset.id === next.asset.id && prev.isLast === next.isLast);

// --- MAIN PAGE ---
const RecycleBin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const observerInstance = useRef<IntersectionObserver | null>(null);

  // --- ACCESS CONTROL ---
  if (!user || user.role !== 'admin') {
      return <div className="min-h-screen flex items-center justify-center">Access Denied</div>;
  }

  // --- DATA FETCHING ---
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
        // Simulated delay to show off the cool loader (Remove setTimeouts in prod!)
        // await new Promise(resolve => setTimeout(resolve, 800)); 
        
        const res = await client.get(`/assets/trash`, { 
            params: { page: pageParam, limit: QUERY_LIMIT } 
        });
        const results = res.data.results || [];
        const nextPage = results.length === QUERY_LIMIT ? (pageParam as number) + 1 : undefined;
        return { results, nextPage, total: res.data.total || 0 };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    staleTime: 0,
    refetchOnWindowFocus: true
  });

  const assets = useMemo(() => {
      return data?.pages.flatMap(p => p.results) || [];
  }, [data]);

  const totalItems = data?.pages[0]?.total || 0;

  // --- SCROLL OBSERVER ---
  const lastAssetRef = useCallback((node: HTMLDivElement) => {
    if (isLoading || isFetchingNextPage) return;
    if (observerInstance.current) observerInstance.current.disconnect();
    
    observerInstance.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) fetchNextPage();
    }, { rootMargin: '400px' });
    
    if (node) observerInstance.current.observe(node);
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  // --- ACTIONS ---
  const handleRestore = async () => {
      if (!restoreId) return;
      try {
          await client.post(`/assets/${restoreId}/restore`);
          toast.success("Asset restored");
          queryClient.setQueryData(['recycle-bin'], (old: any) => {
              if (!old) return old;
              return { ...old, pages: old.pages.map((p: any) => ({ ...p, results: p.results.filter((a: Asset) => a.id !== restoreId) })) };
          });
      } catch (err) { toast.error("Failed to restore"); } 
      finally { setRestoreId(null); }
  };

  const handleDeleteForever = async () => {
      if (!deleteId) return;
      try {
          await client.delete(`/assets/${deleteId}/force`); 
          toast.success("Deleted permanently");
          queryClient.setQueryData(['recycle-bin'], (old: any) => {
              if (!old) return old;
              return { ...old, pages: old.pages.map((p: any) => ({ ...p, results: p.results.filter((a: Asset) => a.id !== deleteId) })) };
          });
      } catch (err) { toast.error("Failed to delete"); } 
      finally { setDeleteId(null); }
  };

  const handleEmptyTrash = async () => {
      if (!window.confirm("WARNING: This will permanently delete ALL items in the trash. Continue?")) return;
      try {
          await client.delete(`/assets/trash/empty`);
          toast.success("Trash emptied");
          refetch();
      } catch (err) { toast.error("Failed to empty trash"); }
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] pb-20 transition-colors duration-500">
      
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-[#1A1D21]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 px-6 py-4 transition-all">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                            Recycle Bin
                            {totalItems > 0 && <span className="text-sm font-medium bg-gray-100 dark:bg-white/10 px-2.5 py-0.5 rounded-full text-gray-500 dark:text-gray-400">{totalItems}</span>}
                        </h1>
                        <p className="text-xs font-medium text-gray-400 mt-0.5">
                            Items are automatically deleted after {AUTO_DELETE_DAYS} days
                        </p>
                    </div>
                </div>

                {assets.length > 0 && (
                     <button 
                        onClick={handleEmptyTrash} 
                        className="group flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-xl text-sm font-bold transition-all border border-red-100 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white shadow-sm"
                     >
                        <Eraser size={16} className="group-hover:rotate-12 transition-transform" /> 
                        Empty Trash
                     </button>
                )}
            </div>
          </div>
      </div>

      {/* CONTENT AREA */}
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 min-h-[50vh]">
        
        {/* 1. INITIAL LOADING (SCANNING) */}
        {isLoading ? (
            <ScanningLoader />
        ) : assets.length === 0 ? (
            /* 2. EMPTY STATE */
            <div className="mt-20 flex flex-col items-center justify-center p-16 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-green-100 dark:bg-green-900/20 p-8 rounded-full mb-6 shadow-sm">
                    <Check size={48} className="text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">System Clean</h3>
                <p className="text-gray-500 max-w-md">
                    No deleted assets found. Your library is running efficiently.
                </p>
            </div>
        ) : (
            /* 3. ASSET GRID */
            <div className="w-full animate-in slide-in-from-bottom-4 duration-700">
                <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
                    {assets.map((asset, index) => (
                        <TrashGridItem 
                            key={asset.id}
                            asset={asset as Asset}
                            index={index}
                            onRestore={() => setRestoreId(asset.id)}
                            onDeleteForever={() => setDeleteId(asset.id)}
                            isLast={index === assets.length - 1}
                            lastAssetRef={lastAssetRef}
                        />
                    ))}
                </Masonry>
                
                {/* BOTTOM LOADER FOR INFINITE SCROLL */}
                {isFetchingNextPage && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-gray-400" size={32} />
                    </div>
                )}
            </div>
        )}
      </div>

      {/* MODALS */}
      <ConfirmModal 
        isOpen={!!restoreId} 
        onClose={() => setRestoreId(null)} 
        onConfirm={handleRestore} 
        title="Restore Asset" 
        message="This asset will be moved back to the library. It will be visible to all authorized users again." 
        confirmText="Restore Asset" 
        confirmColor="bg-green-600 hover:bg-green-700"
      />

      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={handleDeleteForever} 
        title="Permanently Delete" 
        message="This action creates a permanent data loss. The file cannot be recovered." 
        confirmText="Delete Forever" 
        isDangerous={true} 
      />
    </div>
  );
};

export default RecycleBin;