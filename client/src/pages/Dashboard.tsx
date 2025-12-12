import React, { useEffect, useState, useLayoutEffect } from 'react';
import client from '../api/client';
import { Loader2, Image as ImageIcon, Search, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Masonry from 'react-masonry-css';
import AssetThumbnail from '../components/AssetThumbnail';
import DashboardHeader, { type FilterType } from '../components/DashboardHeader';
import { toast } from 'react-toastify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FolderPlus, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Asset {
  id: string;
  filename: string;
  thumbnailPath: string | null;
  mimeType: string;
  originalName: string;
  path: string;
  uploadedBy: { name: string };
  aiData?: string;
}

interface CollectionSimple {
  id: string;
  name: string;
}

const cleanFilename = (name: string) => {
  return name.replace(/\.[^/.]+$/, "");
};

const SCROLL_KEY = 'capydam_dashboard_scroll_y';
const MAIN_SCROLL_KEY = 'capydam_dashboard_main_scroll_y';

const Dashboard = () => {
  // ❌ DELETE these lines if they are red:
  // const { user } = useAuth(); 
  // const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('image');

  // --- MODAL STATE ---
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState('');

  const navigate = useNavigate();

  // --- QUERY ASSETS ---
  const { data: assetData, isLoading: assetsLoading, error: assetError } = useQuery({
    queryKey: ['assets', debouncedSearch, filterType, selectedColor], 
    queryFn: async () => {
      const res = await client.get(`/assets`, {
        params: { search: debouncedSearch, type: filterType, color: selectedColor }
      });
      let results: Asset[] = [];
      let isFallback = false;
      if (res.data.results && Array.isArray(res.data.results)) {
        results = res.data.results;
        isFallback = res.data.isFallback || false;
      } else if (Array.isArray(res.data)) {
        results = res.data;
      }
      return { results, isFallback };
    },
    staleTime: 1000 * 60 * 5, 
    retry: 1,
  });

  // --- QUERY COLLECTIONS ---
  const { data: collections = [], refetch: refetchCollections } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const res = await client.get('/collections');
      return (res.data || []) as CollectionSimple[];
    },
    staleTime: 1000 * 60, // 1 minute
  });

  const assets = assetData?.results || [];
  const loading = assetsLoading;

  // --- SCROLL RESTORATION ---
  useLayoutEffect(() => {
    if (assets.length > 0) {
      const savedPosition = sessionStorage.getItem(SCROLL_KEY);
      if (savedPosition) {
        setTimeout(() => window.scrollTo(0, parseInt(savedPosition)), 100); 
      }
    }
  }, [assets]); 

  const handleSearchChange = (newQuery: string) => {
    if (!searchQuery && newQuery) {
        sessionStorage.setItem(MAIN_SCROLL_KEY, window.scrollY.toString());
        sessionStorage.removeItem(SCROLL_KEY);
    } else if (searchQuery && !newQuery) {
        const mainScroll = sessionStorage.getItem(MAIN_SCROLL_KEY);
        if (mainScroll) sessionStorage.setItem(SCROLL_KEY, mainScroll);
    } else if (searchQuery && newQuery && searchQuery !== newQuery) {
         sessionStorage.removeItem(SCROLL_KEY);
    }
    setSearchQuery(newQuery);
  };

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery); }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (assetData?.isFallback && debouncedSearch) {
       toast.info(`No exact matches for "${debouncedSearch}". Showing recent assets.`, { toastId: 'fallback' });
    }
    if (assetError) toast.error("Failed to load assets");
  }, [assetData, assetError, debouncedSearch]);

  const handleAssetClick = (assetId: string, index: number) => {
    if (debouncedSearch) {
        client.post('/assets/track-click', { assetId, query: debouncedSearch, position: index + 1 }).catch(() => {});
    }
    sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  };

  const getTags = (jsonString?: string) => {
    if (!jsonString) return [];
    try {
      const data = JSON.parse(jsonString);
      if (data.tags && Array.isArray(data.tags)) return data.tags.slice(0, 3);
      return [];
    } catch { return []; }
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

  // --- COLLECTION HANDLERS ---

  const openCollectionModal = (e: React.MouseEvent, assetId: string) => {
      e.preventDefault(); 
      e.stopPropagation();
      setSelectedAssetId(assetId);
      setModalSearch('');
      setIsCollectionModalOpen(true);
      refetchCollections(); // Ensure list is fresh
  };

  const addToCollection = async (collectionId: string, collectionName: string) => {
    if (!selectedAssetId) return;
    
    // Optimistically close modal
    setIsCollectionModalOpen(false);

    const promise = client.post(`/collections/${collectionId}/assets`, { assetId: selectedAssetId });
    
    toast.promise(
        promise,
        {
            pending: 'Adding to collection...',
            success: `Added to ${collectionName}!`,
            error: 'Already in collection'
        },
        { autoClose: 2000 }
    );
  };

  // Filter collections for modal
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

      <div className="px-4 lg:px-8 mt-6 max-w-[2000px] mx-auto">
        
        {loading ? (
            <div className="flex h-64 w-full items-center justify-center">
                <Loader2 className="animate-spin text-blue-500 dark:text-blue-400" size={32} />
            </div>
        ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 p-16 text-center mt-8 opacity-60">
                <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-full mb-4">
                    <ImageIcon size={32} className="text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-lg font-medium text-gray-600 dark:text-gray-300">No assets found</p>
                <button onClick={() => { handleSearchChange(''); setFilterType('image'); setSelectedColor(null); }} className="text-blue-600 dark:text-blue-400 font-medium hover:underline mt-2">Clear all filters</button>
            </div>
        ) : (
            <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
            {assets.map((asset, index) => (
                <div 
                    key={asset.id} 
                    className="group relative mb-8 block transition-all duration-300"
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '300px' }} 
                >
                    <div className="relative">
                        <div className="relative w-full rounded-2xl overflow-hidden transition-all duration-300 bg-gray-100 dark:bg-[#1A1D21] shadow-sm hover:shadow-xl hover:-translate-y-1">
                            <Link to={`/assets/${asset.id}`} className="block cursor-pointer" onClick={() => handleAssetClick(asset.id, index)}>
                                <div className="group-hover:opacity-95 transition-opacity">
                                    <AssetThumbnail mimeType={asset.mimeType} thumbnailPath={asset.thumbnailPath} className="w-full h-auto" />
                                </div>
                            </Link>
                        </div>

                        {/* HOVER ACTIONS (Visible to everyone) */}
                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0">
                            
                            {/* Add to Collection Button */}
                            <button 
                                onClick={(e) => openCollectionModal(e, asset.id)}
                                className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-indigo-600 dark:text-indigo-400 shadow-sm backdrop-blur-md transition-colors hover:bg-indigo-600 hover:text-white"
                                title="Add to Collection"
                            >
                                <FolderPlus size={16} />
                            </button>

                            {/* Download Button */}
                            <button 
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownload(asset); }} 
                                className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-md transition-colors hover:bg-blue-600 hover:text-white"
                                title="Download"
                            >
                                <Download size={16} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="mt-3 px-1">
                        <Link to={`/assets/${asset.id}`} onClick={() => handleAssetClick(asset.id, index)} className="group/link">
                            <p className="truncate font-bold text-sm text-gray-800 dark:text-gray-100 group-hover/link:underline decoration-gray-400 underline-offset-2 transition-all" title={asset.originalName}>{cleanFilename(asset.originalName)}</p>
                        </Link>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 h-5 overflow-hidden opacity-60 hover:opacity-100 transition-opacity">
                            {getTags(asset.aiData).map((tag: string) => (
                                <span key={tag} className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">#{tag}</span>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
            </Masonry>
        )}
      </div>

      {/* --- ADD TO COLLECTION MODAL --- */}
      <AnimatePresence>
        {isCollectionModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                    onClick={() => setIsCollectionModalOpen(false)} 
                />
                
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }} 
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative w-full max-w-md bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
                        <h3 className="font-bold text-gray-900 dark:text-white">Add to Collection</h3>
                        <button onClick={() => setIsCollectionModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
                    </div>

                    {/* Search */}
                    <div className="px-6 py-3 bg-gray-50 dark:bg-white/5">
                        <div className="flex items-center gap-2 bg-white dark:bg-black/20 rounded-xl px-3 py-2 border border-gray-200 dark:border-white/10">
                            <Search size={16} className="text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Find a folder..." 
                                autoFocus
                                value={modalSearch}
                                onChange={(e) => setModalSearch(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm w-full text-gray-800 dark:text-gray-200 placeholder-gray-400"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {filteredCollections.length > 0 ? (
                            filteredCollections.map(c => (
                                <button 
                                    key={c.id} 
                                    onClick={() => addToCollection(c.id, c.name)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left transition-colors group"
                                >
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-110 transition-transform">
                                        <FolderPlus size={18} />
                                    </div>
                                    <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                                        {c.name}
                                    </span>
                                </button>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                {collections.length === 0 ? "You haven't created any collections yet." : "No matching folders found."}
                            </div>
                        )}
                    </div>

                    {/* Footer: Create New */}
                    <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
                        <button 
                            onClick={() => navigate('/collections')}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-3 hover:scale-[1.02] transition-transform"
                        >
                            <Plus size={16} /> Create New Collection
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Dashboard;