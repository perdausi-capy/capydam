import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { ArrowLeft, Trash2, Loader2, FolderOpen } from 'lucide-react';
import Masonry from 'react-masonry-css';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from 'react-toastify';
// 1. IMPORT THE SMART THUMBNAIL
import AssetThumbnail from '../components/AssetThumbnail'; 

interface Asset {
  id: string;
  filename: string;
  thumbnailPath: string | null;
  // 2. ADD MIMETYPE
  mimeType: string; 
  originalName: string;
  uploadedBy: { name: string };
  aiData?: string;
}

interface CollectionData {
  id: string;
  name: string;
  assets: Asset[];
}

const CollectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // State for removing item
  const [assetToRemove, setAssetToRemove] = useState<string | null>(null);

  // Fetch Collection Data
  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const { data } = await client.get(`/collections/${id}`);
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
      await client.delete(`/collections/${id}/assets/${assetToRemove}`);
      
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

  const breakpointColumnsObj = {
    default: 5,
    1536: 4,
    1280: 3,
    1024: 3,
    768: 2,
    640: 1
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
  if (!collection) return <div className="p-10 text-center">Collection not found</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 border-b pb-6">
        <button 
          onClick={() => navigate('/collections')}
          className="mb-4 flex items-center text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Collections
        </button>
        
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
             <FolderOpen size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{collection.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{collection.assets.length} items inside</p>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {collection.assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 p-16 text-center bg-gray-50">
          <p className="text-gray-500 text-lg">This collection is empty.</p>
          <p className="text-gray-400 text-sm mt-2">Go to the Asset Library to add items here.</p>
          <Link to="/" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Go to Library
          </Link>
        </div>
      ) : (
        /* Masonry Grid */
        <Masonry
          breakpointCols={breakpointColumnsObj}
          className="flex w-auto -ml-4"
          columnClassName="pl-4 bg-clip-padding"
        >
          {collection.assets.map((asset) => (
            <div key={asset.id} className="group relative mb-4 block rounded-xl border bg-white shadow-sm transition-all hover:shadow-md">
              
              <Link to={`/assets/${asset.id}`} className="block">
                {/* 3. USE ASSET THUMBNAIL (Handles PDF/Video icons) */}
                <div className="w-full bg-gray-100 rounded-t-xl overflow-hidden min-h-[100px]">
                    <div className="transition-all duration-300 group-hover:brightness-90">
                       <AssetThumbnail 
                          mimeType={asset.mimeType} 
                          thumbnailPath={asset.thumbnailPath}
                          className="w-full h-auto" // Natural height
                       />
                    </div>
                </div>
              </Link>

              {/* Text Info */}
              <div className="p-3">
                 <p className="truncate text-sm font-medium text-gray-900" title={asset.originalName}>
                    {asset.originalName}
                  </p>
              </div>

              {/* Remove Button */}
              <button
                onClick={(e) => handleRemoveClick(e, asset.id)}
                className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                title="Remove from collection"
              >
                <Trash2 size={16} />
              </button>

            </div>
          ))}
        </Masonry>
      )}

      <ConfirmModal 
        isOpen={!!assetToRemove}
        onClose={() => setAssetToRemove(null)}
        onConfirm={confirmRemove}
        title="Remove from Collection"
        message="Are you sure? This will remove the asset from this collection, but it will remain in your main library."
        confirmText="Remove"
        isDangerous={true}
      />
    </div>
  );
};

export default CollectionDetail;