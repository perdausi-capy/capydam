import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import client from '../api/client';
import { Image as ImageIcon, Search, X, Download, FolderPlus, Plus, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Masonry from 'react-masonry-css';
import AssetThumbnail from '../components/AssetThumbnail';
import DashboardHeader, { type FilterType } from '../components/DashboardHeader';
import { toast } from 'react-toastify';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

// --- TYPES ---
interface Asset {
  id: string;
  filename: string;
  thumbnailPath: string | null;
  mimeType: string;
  originalName: string;
  path: string;
  uploadedBy: { name: string };
  aiData?: string;
  previewFrames?: string[];
  isSkeleton?: boolean; // New flag for loading state
}

interface CollectionSimple { id: string; name: string; }

// --- HELPERS ---
const cleanFilename = (name: string) => {
  if (!name) return "Untitled";
  let clean = name.replace(/\.[^/.]+$/, "");
  if (clean.length > 25) return clean.substring(0, 25) + "...";
  return clean;
};

const parseAiData = (jsonString?: string) => {
    if (!jsonString) return { tags: [], link: null };
    try {
        const data = JSON.parse(jsonString);
        return {
            tags: Array.isArray(data.tags) ? data.tags : [],
            link: data.externalLink || data.link || data.url || null
        };
    } catch { return { tags: [], link: null }; }
};

const SCROLL_KEY = 'capydam_dashboard_scroll_y';

// --- 🦴 SKELETON CARD (The "Pinterest" loading effect) ---
const SkeletonCard = () => (
    <div className="mb-8 w-full">
        {/* Image Placeholder */}
        <div className="w-full aspect-[3/4] bg-gray-200 dark:bg-white/5 rounded-2xl animate-pulse" />
        
        {/* Text Placeholders */}
        <div className="mt-3 space-y-2 px-1">
            <div className="h-4 bg-gray-200 dark:bg-white/5 rounded w-3/4 animate-pulse" />
            <div className="flex gap-2">
                <div className="h-3 w-12 bg-gray-200 dark:bg-white/5 rounded-full animate-pulse" />
                <div className="h-3 w-8 bg-gray-200 dark:bg-white/5 rounded-full animate-pulse" />
            </div>
        </div>
    </div>
);

// --- ⚡ REAL CARD COMPONENT ---
const AssetCard = React.memo(({ 
    asset, 
    index, 
    onClick, 
    onDownload, 
    onAddToCollection 
}: { 
    asset: Asset, 
    index: number, 
    onClick: (id: string, idx: number) => void,
    onDownload: (e: React.MouseEvent, asset: Asset) => void,
    onAddToCollection: (e: React.MouseEvent, id: string) => void
}) => {
    const { tags, link } = useMemo(() => parseAiData(asset.aiData), [asset.aiData]);

    return (
        // transform-gpu triggers hardware acceleration for smoother scrolling
        <div className="group relative mb-8 block transition-all duration-300 w-full min-w-0 transform-gpu">
            <div className="relative">
                <div className="relative w-full rounded-2xl overflow-hidden transition-all duration-300 bg-gray-100 dark:bg-[#1A1D21] shadow-sm hover:shadow-xl hover:-translate-y-1">
                    <Link to={`/assets/${asset.id}`} className="block cursor-pointer" onClick={() => onClick(asset.id, index)}>
                        <div className="group-hover:opacity-95 transition-opacity">
                            <AssetThumbnail 
                                mimeType={asset.mimeType} 
                                thumbnailPath={asset.thumbnailPath || asset.path} 
                                previewFrames={asset.previewFrames}
                                className="w-full h-auto"
                                // @ts-ignore 
                                loading="lazy" 
                            />
                        </div>
                    </Link>
                </div>

                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0">
                    {link && (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-indigo-500 dark:text-indigo-400 shadow-sm backdrop-blur-md transition-colors hover:bg-indigo-600 hover:text-white" onClick={(e) => e.stopPropagation()}>
                            <ExternalLink size={16} />
                        </a>
                    )}
                    <button onClick={(e) => onAddToCollection(e, asset.id)} className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-indigo-600 dark:text-indigo-400 shadow-sm backdrop-blur-md transition-colors hover:bg-indigo-600 hover:text-white">
                        <FolderPlus size={16} />
                    </button>
                    <button onClick={(e) => onDownload(e, asset)} className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-md transition-colors hover:bg-blue-600 hover:text-white">
                        <Download size={16} />
                    </button>
                </div>
            </div>
            
            <div className="mt-3 px-1 w-full min-w-0">
                <Link to={`/assets/${asset.id}`} onClick={() => onClick(asset.id, index)} className="group/link block w-full">
                    <p className="truncate font-bold text-sm text-gray-800 dark:text-gray-100 group-hover/link:underline decoration-gray-400 underline-offset-2 transition-all w-full block" title={asset.originalName}>
                        {cleanFilename(asset.originalName)}
                    </p>
                </Link>
                
                <div className="mt-1.5 flex flex-wrap gap-1.5 h-auto overflow-hidden opacity-70 hover:opacity-100 transition-opacity">
                    {tags.slice(0, 5).map((tag: string) => (
                        <span key={tag} className="text-[10px] text-gray-500 dark:text-gray-400 font-medium bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                            #{tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}, (prev, next) => prev.asset.id === next.asset.id);

// --- DASHBOARD COMPONENT ---
const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  
  // ✅ CHANGED: Default filter is now 'all'
  const [filterType, setFilterType] = useState<FilterType>('all');

  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState('');

  const navigate = useNavigate();
  const observer = useRef<IntersectionObserver | null>(null);

  // --- QUERY ---
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: assetsLoading,
    error: assetError
  } = useInfiniteQuery({
    queryKey: ['assets', debouncedSearch, filterType, selectedColor],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await client.get(`/assets`, {
        params: { 
            search: debouncedSearch, 
            type: filterType, 
            color: selectedColor,
            page: pageParam,
            limit: 20 
        }
      });
      const results = res.data.results || (Array.isArray(res.data) ? res.data : []);
      const isFallback = res.data.isFallback || false;
      const nextPage = results.length === 20 ? pageParam + 1 : undefined;
      return { results, isFallback, nextPage };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    staleTime: 1000 * 60 * 2,
  });

  // --- 🪄 MAGIC: Combine Real Assets + Skeletons ---
  const assets = useMemo(() => {
      const realAssets = data?.pages.flatMap(page => page.results) || [];
      
      // If we are fetching more, append 10 "Skeleton" items
      if (isFetchingNextPage) {
          const skeletons = Array.from({ length: 10 }).map((_, i) => ({
              id: `skeleton-${i}`,
              isSkeleton: true, // Marker
              filename: '', thumbnailPath: '', mimeType: '', originalName: '', path: '', uploadedBy: { name: '' }
          }));
          return [...realAssets, ...skeletons];
      }
      
      return realAssets;
  }, [data, isFetchingNextPage]);

  const isFallback = data?.pages[0]?.isFallback || false;

  // --- COLLECTIONS QUERY ---
  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const res = await client.get('/collections');
      return (res.data || []) as CollectionSimple[];
    },
    staleTime: 1000 * 60, 
  });

  // --- SCROLL TRIGGER ---
  const lastAssetRef = useCallback((node: HTMLDivElement) => {
    if (assetsLoading || isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    }, { rootMargin: '200px' });
    if (node) observer.current.observe(node);
  }, [assetsLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  // --- ACTIONS ---
  const handleSearchChange = (newQuery: string) => {
    if (searchQuery !== newQuery) sessionStorage.removeItem(SCROLL_KEY);
    setSearchQuery(newQuery);
  };

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery); }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (isFallback && debouncedSearch) toast.info(`No exact matches. Showing recent assets.`, { toastId: 'fallback' });
    if (assetError) toast.error("Failed to load assets");
  }, [isFallback, assetError, debouncedSearch]);

  const handleAssetClick = useCallback((assetId: string, index: number) => {
    if (assetId.startsWith('skeleton')) return;
    if (debouncedSearch) {
        client.post('/assets/track-click', { assetId, query: debouncedSearch, position: index + 1 }).catch(() => {});
    }
    sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  }, [debouncedSearch]);

  const handleDownload = useCallback(async (e: React.MouseEvent, asset: Asset) => {
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

  const openCollectionModal = useCallback((e: React.MouseEvent, assetId: string) => {
      e.preventDefault(); e.stopPropagation();
      setSelectedAssetId(assetId);
      setModalSearch('');
      setIsCollectionModalOpen(true);
  }, []);

  const addToCollection = async (collectionId: string, collectionName: string) => {
    if (!selectedAssetId) return;
    setIsCollectionModalOpen(false);
    const promise = client.post(`/collections/${collectionId}/assets`, { assetId: selectedAssetId });
    toast.promise(promise, {
        pending: 'Adding...',
        success: `Added to ${collectionName}!`,
        error: 'Already in collection'
    }, { autoClose: 2000 });
  };

  const filteredCollections = collections.filter(c => 
      c.name.toLowerCase().includes(modalSearch.toLowerCase())
  );

  const breakpointColumnsObj = { default: 5, 1536: 4, 1280: 3, 1024: 3, 768: 2, 640: 1 };

  return (
    <div className="min-h-screen pb-20 bg-[#F3F4F6] dark:bg-[#0B0D0F] transition-colors duration-500">
      <DashboardHeader 
        assetsCount={assets?.length || 0}
        searchQuery={searchQuery}
        setSearchQuery={handleSearchChange}
        filterType={filterType}
        setFilterType={(val) => { sessionStorage.removeItem(SCROLL_KEY); setFilterType(val); }}
        selectedColor={selectedColor}
        setSelectedColor={(val) => { sessionStorage.removeItem(SCROLL_KEY); setSelectedColor(val); }}
      />

      <div className="px-4 lg:px-8 mt-6 max-w-[2000px] mx-auto w-full">
        {assetsLoading ? (
            <div className="w-full overflow-hidden">
                <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
                    {Array.from({ length: 15 }).map((_, i) => <SkeletonCard key={i} />)}
                </Masonry>
            </div>
        ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 p-16 text-center mt-8 opacity-60">
                <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-full mb-4"><ImageIcon size={32} className="text-gray-400 dark:text-gray-500" /></div>
                <p className="text-lg font-medium text-gray-600 dark:text-gray-300">No assets found</p>
                {/* ✅ CHANGED: Reset to 'all' instead of 'image' */}
                <button onClick={() => { handleSearchChange(''); setFilterType('all'); setSelectedColor(null); }} className="text-blue-600 dark:text-blue-400 font-medium hover:underline mt-2">Clear all filters</button>
            </div>
        ) : (
            <div className="w-full overflow-hidden">
                <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
                    {assets.map((asset, index) => {
                        if (asset.isSkeleton) {
                            return <SkeletonCard key={asset.id} />;
                        }

                        if (index === assets.length - 11) {
                             return (
                                <div ref={lastAssetRef} key={asset.id}>
                                    <AssetCard asset={asset} index={index} onClick={handleAssetClick} onDownload={handleDownload} onAddToCollection={openCollectionModal} />
                                </div>
                            );
                        }
                        return <AssetCard key={asset.id} asset={asset} index={index} onClick={handleAssetClick} onDownload={handleDownload} onAddToCollection={openCollectionModal} />;
                    })}
                </Masonry>
            </div>
        )}
      </div>

      <AnimatePresence>
        {isCollectionModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCollectionModalOpen(false)} />
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5"><h3 className="font-bold text-gray-900 dark:text-white">Add to Collection</h3><button onClick={() => setIsCollectionModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button></div>
                    <div className="px-6 py-3 bg-gray-50 dark:bg-white/5"><div className="flex items-center gap-2 bg-white dark:bg-black/20 rounded-xl px-3 py-2 border border-gray-200 dark:border-white/10"><Search size={16} className="text-gray-400" /><input type="text" placeholder="Find a folder..." autoFocus value={modalSearch} onChange={(e) => setModalSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full text-gray-800 dark:text-gray-200 placeholder-gray-400" /></div></div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">{filteredCollections.length > 0 ? ( filteredCollections.map(c => (<button key={c.id} onClick={() => addToCollection(c.id, c.name)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left transition-colors group"><div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-110 transition-transform"><FolderPlus size={18} /></div><span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{c.name}</span></button>)) ) : ( <div className="p-8 text-center text-gray-400 text-sm">{collections.length === 0 ? "You haven't created any collections yet." : "No matching folders found."}</div> )}</div>
                    <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5"><button onClick={() => navigate('/collections')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-3 hover:scale-[1.02] transition-transform"><Plus size={16} /> Create New Collection</button></div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;