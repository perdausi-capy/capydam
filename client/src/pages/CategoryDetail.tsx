import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { 
  ArrowLeft, 
  Trash2, 
  FolderOpen, 
  Share2,
  MoreHorizontal,
  Image as ImageIcon,
  Calendar,
  Layout,
  Edit2,
  Check,
  X
} from 'lucide-react';
import Masonry from 'react-masonry-css';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from 'react-toastify';
import AssetThumbnail from '../components/AssetThumbnail'; 
import { useAuth } from '../context/AuthContext';

// --- TYPES ---
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

interface CategoryData {
  id: string;
  name: string;
  group: string;
  assets: Asset[];
  createdAt?: string;
}

// --- CONSTANTS ---
const cleanFilename = (name: string) => name.replace(/\.[^/.]+$/, "");
const breakpointColumnsObj = { default: 4, 1536: 3, 1100: 2, 700: 1 };
const CHUNK_SIZE = 10; 

// --- COMPONENTS ---

// 1. Asset Card (Unchanged)
const AssetCard = React.memo(({ asset, canCurate, onRemove }: { asset: Asset; canCurate: boolean; onRemove: any }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <div className="group relative mb-6 break-inside-avoid rounded-2xl overflow-hidden cursor-pointer shadow-sm border border-gray-100 dark:border-white/5 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300 bg-white dark:bg-[#1A1D21]">
      <Link to={`/assets/${asset.id}`} className="block">
        <div className="relative bg-gray-100 dark:bg-white/5 overflow-hidden min-h-[150px]">
          {!isLoaded && <div className="absolute inset-0 z-10 animate-pulse bg-gray-200 dark:bg-white/5" />}
          <div className={`transition-all duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
            <AssetThumbnail 
              mimeType={asset.mimeType} 
              thumbnailPath={asset.thumbnailPath || asset.path}
              className="w-full h-auto block"
              loading="lazy"
              decoding="async"
              onLoad={() => setIsLoaded(true)}
            />
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
        </div>
      </Link>
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{cleanFilename(asset.originalName)}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-white/5 px-1.5 py-0.5 rounded border border-gray-100 dark:border-white/5">
            {asset.mimeType.split('/')[1] || 'FILE'}
          </span>
        </div>
      </div>
      {canCurate && (
        <button onClick={(e) => onRemove(e, asset.id)} className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-black/80 text-gray-400 dark:text-gray-400 shadow-md backdrop-blur-sm opacity-0 transform scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
});

// 2. Skeleton Card (Unchanged)
const SkeletonCard = () => (
  <div className="mb-6 break-inside-avoid rounded-2xl overflow-hidden bg-white dark:bg-[#1A1D21] border border-gray-100 dark:border-white/5 shadow-sm">
      <div className="w-full h-48 bg-gray-200 dark:bg-white/5 animate-pulse" />
      <div className="p-3 space-y-2">
         <div className="h-4 w-3/4 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
         <div className="h-3 w-1/4 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
      </div>
  </div>
);

// 3. Page Skeleton (Unchanged)
const PageSkeleton = () => (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] pb-20">
      <div className="bg-white dark:bg-[#1A1D21] border-b border-gray-200 dark:border-white/5 px-6 py-4 sticky top-0 z-20">
         <div className="mx-auto max-w-7xl animate-pulse">
            <div className="h-4 w-24 bg-gray-200 dark:bg-white/5 rounded mb-4"></div>
            <div className="flex gap-5">
               <div className="h-16 w-16 bg-gray-200 dark:bg-white/5 rounded-2xl"></div>
               <div className="space-y-3">
                  <div className="h-8 w-64 bg-gray-200 dark:bg-white/5 rounded"></div>
                  <div className="h-4 w-32 bg-gray-200 dark:bg-white/5 rounded"></div>
               </div>
            </div>
         </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
        </Masonry>
      </div>
    </div>
);

// --- MAIN PAGE COMPONENT ---
const CategoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Data States
  const [category, setCategory] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // UI States
  const [assetToRemove, setAssetToRemove] = useState<string | null>(null); // For removing asset from category
  const [isDeletingCategory, setIsDeletingCategory] = useState(false); // For deleting the category itself
  const [showMenu, setShowMenu] = useState(false);
  
  // Editing Name States
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState("");

  // Infinite Scroll State
  const [displayLimit, setDisplayLimit] = useState(CHUNK_SIZE);
  const [isAppending, setIsAppending] = useState(false);
  
  const observerTarget = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const canCurate = user?.role === 'admin' || user?.role === 'editor';

  // Fetch Logic
  useEffect(() => {
    const fetchCategory = async () => {
      try {
        const { data } = await client.get(`/categories/${id}`); 
        setCategory(data);
        setNewName(data.name); // Initialize edit name
      } catch (error) {
        toast.error("Failed to load category");
      } finally {
        setLoading(false);
      }
    };
    fetchCategory();
  }, [id]);

  // Click Outside to close Menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Infinite Scroll Observer
  useEffect(() => {
    if (!category || displayLimit >= category.assets.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isAppending) {
            setIsAppending(true);
            setTimeout(() => {
                setDisplayLimit((prev) => prev + CHUNK_SIZE);
                setIsAppending(false);
            }, 300); 
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => { if (observerTarget.current) observer.unobserve(observerTarget.current); };
  }, [category, displayLimit, isAppending]);

  // --- HANDLERS ---

  // 1. Share Logic
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
  };

  // 2. Rename Logic
  const handleRename = async () => {
    if (!newName.trim() || !category) return;
    try {
      await client.put(`/categories/${category.id}`, { name: newName });
      setCategory({ ...category, name: newName });
      setIsEditing(false);
      toast.success("Category renamed successfully");
    } catch (error) {
      toast.error("Failed to rename category");
    }
  };

  // 3. Delete Category Logic
  const handleDeleteCategory = async () => {
    try {
      await client.delete(`/categories/${id}`);
      toast.success("Category deleted");
      navigate('/categories'); // Go back to main list
    } catch (error) {
      toast.error("Failed to delete category");
    }
  };

  // 4. Remove Asset Logic (Memoized)
  const handleRemoveAssetClick = useCallback((e: React.MouseEvent, assetId: string) => {
    e.preventDefault(); e.stopPropagation();
    setAssetToRemove(assetId);
  }, []);

  const confirmRemoveAsset = async () => {
    if (!assetToRemove) return;
    try {
      await client.delete(`/categories/${id}/assets/${assetToRemove}`);
      setCategory(prev => prev ? ({ ...prev, assets: prev.assets.filter(a => a.id !== assetToRemove) }) : null);
      toast.success('Removed from category');
    } catch (error) { toast.error('Failed to remove asset'); } finally { setAssetToRemove(null); }
  };

  const visibleAssets = useMemo(() => {
    if (!category?.assets) return [];
    return category.assets.slice(0, displayLimit);
  }, [category?.assets, displayLimit]);

  if (loading) return <PageSkeleton />;

  if (!category) return (
      <div className="flex h-screen flex-col items-center justify-center text-center dark:bg-[#0B0D0F] dark:text-white">
          <div className="rounded-full bg-red-50 dark:bg-red-900/20 p-4 text-red-500 mb-4"><FolderOpen size={32}/></div>
          <h2 className="text-xl font-bold">Category Not Found</h2>
          <button onClick={() => navigate('/categories')} className="mt-4 text-blue-600 dark:text-blue-400 font-medium hover:underline">Back to Topics</button>
      </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] pb-20 transition-colors duration-500">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-[#1A1D21] border-b border-gray-200 dark:border-white/5 px-6 py-4 md:px-10 sticky top-0 z-20 transition-colors">
          <div className="mx-auto max-w-7xl">
            <button onClick={() => navigate('/categories')} className="group mb-4 flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <div className="mr-2 rounded-full p-1 group-hover:bg-blue-50 dark:group-hover:bg-white/10 transition-colors"><ArrowLeft size={16} /></div>
                Back to Topics
            </button>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div className="flex items-start gap-5 w-full">
                    <div className="hidden md:flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800/30 text-purple-600 dark:text-purple-400 shadow-sm">
                        <Layout size={32} strokeWidth={1.5} />
                    </div>
                    
                    {/* Title Section (Switch between Text and Input) */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3 h-9">
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="h-9 px-2 rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-black/20 text-xl font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        autoFocus
                                    />
                                    <button onClick={handleRename} className="p-1.5 rounded-full bg-green-100 text-green-600 hover:bg-green-200"><Check size={18}/></button>
                                    <button onClick={() => setIsEditing(false)} className="p-1.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200"><X size={18}/></button>
                                </div>
                            ) : (
                                <>
                                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{category.name}</h1>
                                    <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-200">{category.group}</span>
                                </>
                            )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1.5"><ImageIcon size={14} /> {category.assets.length} items</span>
                        </div>
                    </div>
                </div>

                {/* --- ACTIONS BUTTONS --- */}
                <div className="flex items-center gap-3 relative">
                    {/* SHARE BUTTON */}
                    <button 
                        onClick={handleShare}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-all active:scale-95"
                    >
                        <Share2 size={16} /> Share
                    </button>
                    
                    {/* MORE BUTTON (Permission Gated for Dropdown) */}
                    {canCurate && (
                        <div ref={menuRef} className="relative">
                            <button 
                                onClick={() => setShowMenu(!showMenu)}
                                className={`flex items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-2 text-gray-500 dark:text-gray-400 shadow-sm transition-all ${showMenu ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/10'}`}
                            >
                                <MoreHorizontal size={20} />
                            </button>

                            {/* DROPDOWN MENU */}
                            {showMenu && (
                                <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl bg-white dark:bg-[#1A1D21] border border-gray-100 dark:border-white/10 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 overflow-hidden">
                                    <div className="p-1">
                                        <button 
                                            onClick={() => { setIsEditing(true); setShowMenu(false); }}
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                                        >
                                            <Edit2 size={16} /> Rename Category
                                        </button>
                                        <button 
                                            onClick={() => { setIsDeletingCategory(true); setShowMenu(false); }}
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            <Trash2 size={16} /> Delete Category
                                        </button>
                                    </div>
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
        {category.assets.length === 0 ? (
            <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 p-16 text-center">
                <div className="mb-4 rounded-full bg-purple-50 dark:bg-purple-900/20 p-4 text-purple-500 dark:text-purple-400"><Layout size={32} /></div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">This topic is empty</h3>
                <Link to="/library" className="mt-6 rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-purple-700 transition-all">Browse Library</Link>
            </div>
        ) : (
            <>
                <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
                    {visibleAssets.map((asset) => (
                        <AssetCard key={asset.id} asset={asset} canCurate={canCurate} onRemove={handleRemoveAssetClick} />
                    ))}
                    {isAppending && [...Array(4)].map((_, i) => <SkeletonCard key={`skel-${i}`} />)}
                </Masonry>
                {visibleAssets.length < category.assets.length && (
                    <div ref={observerTarget} className="h-10 w-full" />
                )}
            </>
        )}
      </div>

      {/* CONFIRM MODAL (Delete Asset) */}
      <ConfirmModal 
        isOpen={!!assetToRemove} 
        onClose={() => setAssetToRemove(null)} 
        onConfirm={confirmRemoveAsset} 
        title="Remove Asset" 
        message="Are you sure? This will remove the asset from this category." 
        confirmText="Remove" 
        isDangerous={true} 
      />

      {/* CONFIRM MODAL (Delete Category) */}
      <ConfirmModal 
        isOpen={isDeletingCategory} 
        onClose={() => setIsDeletingCategory(false)} 
        onConfirm={handleDeleteCategory} 
        title="Delete Category" 
        message="Are you sure? This will permanently delete this category. (Assets will remain in the library)." 
        confirmText="Delete Category" 
        isDangerous={true} 
      />
    </div>
  );
};

export default CategoryDetail;