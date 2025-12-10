import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { 
    ArrowLeft, 
    Trash2, 
    Loader2, 
    FolderOpen, 
    Share2,
    MoreHorizontal,
    Image as ImageIcon,
    Calendar,
    Layout // Using Layout icon for Categories to distinguish from User Collections
} from 'lucide-react';
import Masonry from 'react-masonry-css';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from 'react-toastify';
import AssetThumbnail from '../components/AssetThumbnail'; 
import { useAuth } from '../context/AuthContext';

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
  group: string; // "Features" or "Inspiration"
  assets: Asset[];
  createdAt?: string;
}

// Helper
const cleanFilename = (name: string) => name.replace(/\.[^/.]+$/, "");
// const formatBytes = (bytes?: number) => bytes ? (bytes/1024/1024).toFixed(2) + ' MB' : '0B';

const CategoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [category, setCategory] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [assetToRemove, setAssetToRemove] = useState<string | null>(null);

  // Permissions: Only Admin/Editor can curate (remove assets) from global categories
  const canCurate = user?.role === 'admin' || user?.role === 'editor';

  useEffect(() => {
    const fetchCategory = async () => {
      try {
        const { data } = await client.get(`/categories/${id}`); 
        setCategory(data);
      } catch (error) {
        console.error("Failed to load category");
        toast.error("Failed to load category");
      } finally {
        setLoading(false);
      }
    };
    fetchCategory();
  }, [id]);

  const handleRemoveClick = (e: React.MouseEvent, assetId: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    setAssetToRemove(assetId);
  };

  const confirmRemove = async () => {
    if (!assetToRemove) return;
    try {
      await client.delete(`/categories/${id}/assets/${assetToRemove}`);
      
      setCategory(prev => prev ? ({
        ...prev,
        assets: prev.assets.filter(a => a.id !== assetToRemove)
      }) : null);
      
      toast.success('Removed from category');
    } catch (error) {
      toast.error('Failed to remove asset');
    } finally {
      setAssetToRemove(null);
    }
  };

  const breakpointColumnsObj = { default: 5, 1536: 4, 1280: 3, 1024: 3, 768: 2, 640: 1 };

  if (loading) return (
      <div className="flex h-screen items-center justify-center dark:bg-[#0B0D0F]">
          <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={40} />
      </div>
  );

  if (!category) return (
      <div className="flex h-screen flex-col items-center justify-center text-center dark:bg-[#0B0D0F] dark:text-white">
          <div className="rounded-full bg-red-50 dark:bg-red-900/20 p-4 text-red-500 mb-4"><FolderOpen size={32}/></div>
          <h2 className="text-xl font-bold">Category Not Found</h2>
          <button onClick={() => navigate('/categories')} className="mt-4 text-blue-600 dark:text-blue-400 font-medium hover:underline">Back to Topics</button>
      </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] pb-20 transition-colors duration-500">
      
      {/* --- HERO HEADER --- */}
      <div className="bg-white/80 dark:bg-[#1A1D21]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 px-6 py-6 md:px-10 sticky top-0 z-20 transition-colors">
          <div className="mx-auto max-w-7xl">
            {/* Breadcrumb */}
            <button 
                onClick={() => navigate('/categories')}
                className="group mb-4 flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
                <div className="mr-2 rounded-full p-1 group-hover:bg-blue-50 dark:group-hover:bg-white/10 transition-colors">
                    <ArrowLeft size={16} />
                </div>
                Back to Topics
            </button>

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                {/* Title Section */}
                <div className="flex items-start gap-5">
                    {/* Different Color for Categories (Purple/Blue Gradient) */}
                    <div className="hidden md:flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800/30 text-purple-600 dark:text-purple-400 shadow-sm">
                        <Layout size={32} strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{category.name}</h1>
                            {/* Group Badge */}
                            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-200">
                                {category.group}
                            </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1.5">
                                <ImageIcon size={14} /> {category.assets.length} items
                            </span>
                            {category.createdAt && (
                                <span className="flex items-center gap-1.5">
                                    <Calendar size={14} /> Created {new Date(category.createdAt).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-all">
                        <Share2 size={16} /> Share
                    </button>
                    <button className="flex items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10 shadow-sm">
                        <MoreHorizontal size={20} />
                    </button>
                </div>
            </div>
          </div>
      </div>

      {/* --- CONTENT GRID --- */}
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        
        {/* Empty State */}
        {category.assets.length === 0 ? (
            <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 p-16 text-center">
                <div className="mb-4 rounded-full bg-purple-50 dark:bg-purple-900/20 p-4 text-purple-500 dark:text-purple-400">
                    <Layout size={32} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">This topic is empty</h3>
                <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
                    Add assets here from the Asset Detail page to curate this topic.
                </p>
                <Link 
                    to="/" 
                    className="mt-6 rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-purple-700 transition-all"
                >
                    Browse Library
                </Link>
            </div>
        ) : (
            /* Masonry Grid */
            <Masonry
                breakpointCols={breakpointColumnsObj}
                className="flex w-auto -ml-6"
                columnClassName="pl-6 bg-clip-padding"
            >
                {category.assets.map((asset) => (
                    <div 
                        key={asset.id} 
                        className="group relative mb-6 break-inside-avoid rounded-2xl overflow-hidden cursor-pointer shadow-sm border border-gray-100 dark:border-white/5 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300 bg-white dark:bg-[#1A1D21]"
                    >
                        
                        <Link to={`/assets/${asset.id}`} className="block">
                            {/* Thumbnail Wrapper */}
                            <div className="relative bg-gray-100 dark:bg-white/5 overflow-hidden">
                                <div className="transition-transform duration-500 group-hover:scale-105">
                                    <AssetThumbnail 
                                        mimeType={asset.mimeType} 
                                        thumbnailPath={asset.thumbnailPath || asset.path}
                                        className="w-full h-auto block"
                                    />
                                </div>
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                            </div>
                        </Link>

                        {/* Card Footer */}
                        <div className="p-3">
                            <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200" title={asset.originalName}>
                                {cleanFilename(asset.originalName)}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-white/5 px-1.5 py-0.5 rounded border border-gray-100 dark:border-white/5">
                                    {asset.mimeType.split('/')[1] || 'FILE'}
                                </span>
                            </div>
                        </div>

                        {/* Floating Remove Button (Permission Gated) */}
                        {canCurate && (
                            <button
                                onClick={(e) => handleRemoveClick(e, asset.id)}
                                className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-black/80 text-gray-400 dark:text-gray-400 shadow-md backdrop-blur-sm opacity-0 transform scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
                                title="Remove from category"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}

                    </div>
                ))}
            </Masonry>
        )}
      </div>

      <ConfirmModal 
        isOpen={!!assetToRemove}
        onClose={() => setAssetToRemove(null)}
        onConfirm={confirmRemove}
        title="Remove Asset"
        message="Are you sure you want to remove this asset from the category?"
        confirmText="Remove"
        isDangerous={true}
      />
    </div>
  );
};

export default CategoryDetail;