import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { Loader2, Search, X, Download, FolderPlus, Plus, Image as ImageIcon, Film, FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Masonry from 'react-masonry-css';
import AssetThumbnail from '../components/AssetThumbnail';
import { toast } from 'react-toastify';

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


// Define valid filter types
type FilterType = 'image' | 'video' | 'document'; // 'all' removed from UI types

const colorFilters = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Gray', hex: '#6b7280' },
];

const Dashboard = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [collections, setCollections] = useState<CollectionSimple[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  
  // FIX 1: Set default to 'image' so it doesn't show mixed content
  const [filterType, setFilterType] = useState<FilterType>('image');

  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update useEffect
  useEffect(() => {
    fetchData(debouncedSearch, filterType, selectedColor);
  }, [debouncedSearch, filterType, selectedColor]);

  const fetchData = async (query = '', type: FilterType, color: string | null) => {
    setLoading(true);
    try {
      const assetsRes = await client.get(`/assets`, {
        params: { 
            search: query, 
            type: type,
            color: color // <--- Pass to backend
        }
      });
      setAssets(assetsRes.data);
      
      const colRes = await client.get('/collections');
      setCollections(colRes.data);
    } catch (error) {
      console.error('Failed to fetch data', error);
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const getTags = (jsonString?: string) => {
    if (!jsonString) return [];
    try {
      const data = JSON.parse(jsonString);
      return data.tags?.slice(0, 3) || [];
    } catch {
      return [];
    }
  };

  const handleDownload = async (asset: Asset) => {
    try {
      toast.info('Download started...', { autoClose: 2000 });
      const response = await fetch(`http://localhost:5000/${asset.path}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = asset.originalName;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      toast.error('Download failed');
    }
  };

  const toggleDropdown = (e: React.MouseEvent, assetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDropdownId(activeDropdownId === assetId ? null : assetId);
  };

  const addToCollection = async (e: React.MouseEvent, collectionId: string, collectionName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeDropdownId) return;

    try {
      await client.post(`/collections/${collectionId}/assets`, { assetId: activeDropdownId });
      toast.success(`Added to ${collectionName}`);
      setActiveDropdownId(null);
    } catch (error) {
      toast.warning('Asset is already in that collection.');
      setActiveDropdownId(null);
    }
  };

  const breakpointColumnsObj = {
    default: 5,
    1536: 4,
    1280: 3,
    1024: 3,
    768: 2,
    640: 1
  };

// Inside Dashboard.tsx

  const FilterTab = ({ label, type, icon: Icon }: { label: string, type: FilterType, icon: any }) => (
    <button
      onClick={() => setFilterType(type)}
      className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-300
        ${filterType === type 
          ? 'bg-neutral-dark text-white shadow-lg scale-105' // Active: Dark pill (Premium feel)
          : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-primary shadow-sm border border-transparent hover:border-gray-200'}
      `}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen pb-20">
      
      {activeDropdownId && (
        <div className="fixed inset-0 z-40 cursor-default" onClick={() => setActiveDropdownId(null)} />
      )}

      {/* Header Area */}
      <div className="mb-8 flex flex-col gap-6">
        
        {/* Top Row: Title + Search */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Asset Library</h1>
              <p className="text-sm text-gray-500">{assets.length} results found</p>
            </div>

            <div className="relative w-full max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 pl-10 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 shadow-sm"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
        </div>

        {/* Second Row: Filter Tabs (FIX 2: Removed "All Assets") */}
        <div className="flex flex-wrap gap-3">
            <FilterTab label="Images" type="image" icon={ImageIcon} />
            <FilterTab label="Videos" type="video" icon={Film} />
            <FilterTab label="Documents" type="document" icon={FileText} />
        </div>

        {/* Color Filters */}
        <div className="flex flex-wrap gap-2 items-center mt-4 border-t border-gray-100 pt-4">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Filter by Color:</span>
            
            {/* Reset Color Button */}
            {selectedColor && (
                <button 
                    onClick={() => setSelectedColor(null)}
                    className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                >
                    Clear
                </button>
            )}

            {colorFilters.map((c) => (
                <button
                    key={c.name}
                    onClick={() => setSelectedColor(selectedColor === c.name ? null : c.name)}
                    title={`Filter by ${c.name}`}
                    className={`
                        w-6 h-6 rounded-full border border-gray-200 shadow-sm transition-all hover:scale-110
                        ${selectedColor === c.name ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''}
                    `}
                    style={{ backgroundColor: c.hex }}
                />
            ))}
        </div>

      </div>

      {loading ? (
        <div className="flex h-64 w-full items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="mb-4 text-gray-500">No assets found in this category.</p>
          <button onClick={() => { setSearchQuery(''); }} className="text-blue-600 hover:underline">Clear search</button>
        </div>
      ) : (
        <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-4" columnClassName="pl-4 bg-clip-padding">
          {assets.map((asset) => (
            <div 
              key={asset.id} 
              // NEW CLASSES: rounded-2xl (more curve), hover:shadow-glow (blue glow), border-transparent (cleaner)
              className={`group relative mb-6 block rounded-2xl border border-white bg-white p-2 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-glow 
                ${activeDropdownId === asset.id ? 'z-50 ring-2 ring-primary ring-offset-2' : 'z-0'}
              `}
            >
              <div className="relative w-full bg-gray-100 rounded-t-xl overflow-visible min-h-[100px]">
                <Link to={`/assets/${asset.id}`} className="block cursor-pointer">
                    <div className="transition-all duration-300 group-hover:brightness-90">
                       <AssetThumbnail mimeType={asset.mimeType} thumbnailPath={asset.thumbnailPath} className="w-full h-auto min-h-[100px] rounded-t-xl" />
                    </div>
                </Link>
                {/* Actions & Dropdown (Existing Code) */}
                <div className={`absolute top-2 right-2 flex gap-2 transition-opacity duration-200 ${activeDropdownId === asset.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <div className="relative">
                        <button onClick={(e) => toggleDropdown(e, asset.id)} className={`rounded-full p-2 shadow-sm backdrop-blur-sm transition-colors ${activeDropdownId === asset.id ? 'bg-blue-600 text-white' : 'bg-white/90 text-gray-600 hover:bg-blue-500 hover:text-white'}`}><FolderPlus size={18} /></button>
                        {activeDropdownId === asset.id && (
                            <div className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-lg bg-white shadow-xl ring-1 ring-black/5 overflow-hidden animate-in fade-in zoom-in-95 duration-100 cursor-default z-50">
                                <div className="max-h-56 overflow-y-auto py-1">
                                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50">Add to Collection</div>
                                    {collections.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-gray-500 text-center">No collections found.</div>
                                    ) : (
                                        collections.map(col => (
                                            <button key={col.id} onClick={(e) => addToCollection(e, col.id, col.name)} className="flex w-full items-center px-4 py-3 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer border-b border-gray-50 last:border-0">
                                                <FolderPlus size={14} className="mr-2 text-gray-400" />
                                                <span className="truncate font-medium">{col.name}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                                <div className="border-t bg-gray-50 p-2">
                                    <button onClick={(e) => { e.preventDefault(); navigate('/collections'); }} className="flex w-full items-center justify-center rounded px-2 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100 transition-colors"><Plus size={14} className="mr-1" /> Create New</button>
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownload(asset); }} className="rounded-full bg-white/90 p-2 text-gray-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-blue-500 hover:text-white"><Download size={18} /></button>
                </div>
              </div>
              <div className="px-2 pt-3 pb-1">
                {/* Use Heading Font for title */}
                <Link to={`/assets/${asset.id}`}>
                    <p className="truncate font-heading text-sm font-semibold text-neutral-dark hover:text-primary transition-colors" title={asset.originalName}>
                      {asset.originalName}
                    </p>
                </Link>
                
                {/* Tags with accent colors */}
                <div className="mt-2 flex flex-wrap gap-1.5 h-6 overflow-hidden">
                  {getTags(asset.aiData).map((tag: string) => (
                    <span key={tag} className="rounded-md bg-neutral-light px-2 py-0.5 text-[10px] font-medium text-neutral-mid border border-gray-100">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </Masonry>
      )}
    </div>
  );
};

export default Dashboard;