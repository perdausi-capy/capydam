import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { 
    ArrowLeft, 
    Trash2, 
    Loader2, 
    FolderOpen, 
    MoreHorizontal,
    Share2,
    Calendar,
    Image as ImageIcon
} from 'lucide-react';
import Masonry from 'react-masonry-css';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from 'react-toastify';
import AssetThumbnail from '../components/AssetThumbnail'; 

interface Asset {
  id: string;
  filename: string;
  thumbnailPath: string | null;
  mimeType: string; 
  originalName: string;
  uploadedBy: { name: string };
  aiData?: string;
  createdAt?: string; 
  path: string; // Ensure path is here for thumbnail fallback
}

interface CollectionData {
  id: string;
  name: string;
  assets: Asset[];
  createdAt?: string;
}

const CollectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [assetToRemove, setAssetToRemove] = useState<string | null>(null);

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const { data } = await client.get(`/collections/${id}`); // Fixed path
        setCollection(data);
      } catch (error) {
        console.error("Failed to load collection");
        toast.error("Failed to load collection");
      } finally {
        setLoading(false);
      }
    };
    fetchCollection();
  }, [id]);

  const handleRemoveClick = (e: React.MouseEvent, assetId: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    setAssetToRemove(assetId);
  };

  const confirmRemove = async () => {   
    if (!assetToRemove) return;
    try {
      await client.delete(`/collections/${id}/assets/${assetToRemove}`); // Fixed path
      
      setCollection(prev => prev ? ({
        ...prev,
        assets: prev.assets.filter(a => a.id !== assetToRemove)
      }) : null);
      
      toast.success('Removed from collection');
    } catch (error) {
      toast.error('Failed to remove asset');
    } finally {
      setAssetToRemove(null);
    }
  };

  const breakpointColumnsObj = { default: 5, 1536: 4, 1280: 3, 1024: 3, 768: 2, 640: 1 };

  if (loading) return <div className="flex h-[50vh] items-center justify-center dark:bg-[#0B0D0F]"><Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={40} /></div>;

  if (!collection) return (
      <div className="mt-20 flex flex-col items-center justify-center text-center dark:text-white">
          <div className="rounded-full bg-red-50 dark:bg-red-900/20 p-4 text-red-500 mb-4"><FolderOpen size={32}/></div>
          <h2 className="text-xl font-bold">Collection Not Found</h2>
          <button onClick={() => navigate('/collections')} className="mt-4 text-blue-600 dark:text-blue-400 font-medium hover:underline">Back to Collections</button>
      </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] pb-20 transition-colors duration-500">
      
      {/* --- HERO HEADER --- */}
      <div className="bg-white/80 dark:bg-[#1A1D21]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 px-6 py-8 md:px-10 transition-colors">
          <div className="mx-auto max-w-7xl">
            {/* Breadcrumb */}
            <button 
                onClick={() => navigate('/collections')}
                className="group mb-6 flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
                <div className="mr-2 rounded-full p-1 group-hover:bg-blue-50 dark:group-hover:bg-white/10 transition-colors">
                    <ArrowLeft size={16} />
                </div>
                Back to Collections
            </button>

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                {/* Title Section */}
                <div className="flex items-start gap-5">
                    <div className="hidden md:flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 shadow-sm">
                        <FolderOpen size={40} strokeWidth={1.5} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{collection.name}</h1>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1.5">
                                <ImageIcon size={14} /> {collection.assets.length} Assets
                            </span>
                            {collection.createdAt && (
                                <span className="flex items-center gap-1.5">
                                    <Calendar size={14} /> Created {new Date(collection.createdAt).toLocaleDateString()}
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

      {/* --- MAIN CONTENT --- */}
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        
        {/* Empty State */}
        {collection.assets.length === 0 ? (
            <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 p-16 text-center">
                <div className="mb-4 rounded-full bg-blue-50 dark:bg-blue-900/20 p-4 text-blue-500 dark:text-blue-400">
                    <FolderOpen size={32} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">This collection is empty</h3>
                <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
                    Start adding images from your main library to organize them here.
                </p>
                <Link 
                    to="/" 
                    className="mt-6 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-all"
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
                {collection.assets.map((asset) => (
                    <div key={asset.id} className="group relative mb-6 break-inside-avoid">
                        
                        {/* Card Container */}
                        <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] shadow-sm transition-all duration-300 hover:shadow-lg hover:translate-y-[-2px]">
                            
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
                                    
                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                                </div>
                            </Link>

                            {/* Card Footer */}
                            <div className="flex items-center justify-between p-3">
                                <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300 max-w-[80%]" title={asset.originalName}>
                                    {asset.originalName}
                                </p>
                                {/* File Type Badge */}
                                <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                                    {asset.mimeType.split('/')[1] || 'FILE'}
                                </span>
                            </div>
                        </div>

                        {/* Floating Action Button */}
                        <button
                            onClick={(e) => handleRemoveClick(e, asset.id)}
                            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-black/80 text-gray-400 shadow-md backdrop-blur-sm opacity-0 transform scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
                            title="Remove from collection"
                        >
                            <Trash2 size={14} />
                        </button>

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
        message="Are you sure you want to remove this asset from the collection? It will still be available in your main library."
        confirmText="Remove"
        isDangerous={true}
      />
    </div>
  );
};

export default CollectionDetail;