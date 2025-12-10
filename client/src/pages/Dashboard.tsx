import React, { useEffect, useState, useLayoutEffect } from 'react';
import client from '../api/client';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Masonry from 'react-masonry-css';
import AssetThumbnail from '../components/AssetThumbnail';
import DashboardHeader, { type FilterType } from '../components/DashboardHeader';
import { toast } from 'react-toastify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FolderPlus, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('image');

  const navigate = useNavigate();
  const canAddToCollection = user?.role !== 'viewer'; 

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
  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const res = await client.get('/collections');
      return (res.data || []) as CollectionSimple[];
    },
    staleTime: 0, 
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
      toast.info('Download started...', { autoClose: 2000 });
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

  const addToCollection = async (e: React.MouseEvent, collectionId: string, collectionName: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!activeDropdownId) return;
    try {
      await client.post(`/collections/${collectionId}/assets`, { assetId: activeDropdownId });
      await queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success(`Added to ${collectionName}`);
      setActiveDropdownId(null);
    } catch (error: any) {
      if (error.response?.status === 403) toast.error("Permission denied.");
      else if (error.response?.status === 404) toast.error("Collection not found.");
      else toast.info('Asset is likely already in this collection.');
      setActiveDropdownId(null);
    }
  };

  const breakpointColumnsObj = { default: 5, 1536: 4, 1280: 3, 1024: 3, 768: 2, 640: 1 };

  return (
    <div className="min-h-screen pb-20 bg-[#F3F4F6] dark:bg-[#0B0D0F] transition-colors duration-500">
      
      {activeDropdownId && (
        <div className="fixed inset-0 z-40 cursor-default" onClick={() => setActiveDropdownId(null)} />
      )}

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
                    // 1. LIGHTWEIGHT CONTAINER (No border/bg)
                    className={`group relative mb-8 block transition-all duration-300 
                        ${activeDropdownId === asset.id ? 'z-50' : 'z-0'}
                    `}
                    // 2. PERFORMANCE: Stop rendering off-screen items
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '300px' }} 
                >
                    {/* --- IMAGE AREA (The "Card" is now just the image) --- */}
                    <div className="relative">
                        
                        {/* Image Wrapper */}
                        <div className={`
                            relative w-full rounded-2xl overflow-hidden transition-all duration-300
                            bg-gray-100 dark:bg-[#1A1D21] 
                            shadow-sm hover:shadow-md
                            ${activeDropdownId === asset.id ? 'ring-4 ring-blue-500/20' : ''}
                        `}>
                            <Link to={`/assets/${asset.id}`} className="block cursor-pointer" onClick={() => handleAssetClick(asset.id, index)}>
                                <div className="group-hover:opacity-95 transition-opacity">
                                    <AssetThumbnail mimeType={asset.mimeType} thumbnailPath={asset.thumbnailPath} className="w-full h-auto" />
                                </div>
                            </Link>
                        </div>

                        {/* Buttons (Floating - No Clipping) */}
                        <div className={`absolute top-3 right-3 flex gap-2 transition-opacity duration-200 ${activeDropdownId === asset.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            <div className="relative">
                                {canAddToCollection && (
                                    <>
                                        <button onClick={(e) => toggleDropdown(e, asset.id)} className={`rounded-full p-2 shadow-sm backdrop-blur-md transition-colors ${activeDropdownId === asset.id ? 'bg-blue-600 text-white' : 'bg-white/90 dark:bg-black/60 text-gray-700 dark:text-gray-200 hover:bg-blue-600 hover:text-white'}`}><FolderPlus size={16} /></button>
                                        
                                        {activeDropdownId === asset.id && (
                                            <div className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-xl bg-white dark:bg-[#1F2227] shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-100 cursor-default z-50">
                                                <div className="max-h-56 overflow-y-auto py-1 custom-scrollbar">
                                                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">Add to Collection</div>
                                                    {collections?.length === 0 ? (
                                                        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">No collections found.</div>
                                                    ) : (
                                                        collections?.map((col: CollectionSimple) => (
                                                            <button key={col.id} onClick={(e) => addToCollection(e, col.id, col.name)} className="flex w-full items-center px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-white/5 hover:text-blue-700 dark:hover:text-blue-400 transition-colors cursor-pointer border-b border-gray-50 dark:border-white/5 last:border-0">
                                                                <FolderPlus size={14} className="mr-2 text-gray-400 dark:text-gray-500" />
                                                                <span className="truncate font-medium">{col.name}</span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                                <div className="border-t bg-gray-50 dark:bg-white/5 dark:border-white/5 p-2">
                                                    <button onClick={(e) => { e.preventDefault(); navigate('/collections'); }} className="flex w-full items-center justify-center rounded-lg px-2 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"><Plus size={14} className="mr-1" /> Create New</button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownload(asset); }} className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-md transition-colors hover:bg-blue-600 hover:text-white"><Download size={16} /></button>
                        </div>
                    </div>
                    
                    {/* --- TEXT INFO (Clean, outside the image) --- */}
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
    </div>
  );
};

export default Dashboard;