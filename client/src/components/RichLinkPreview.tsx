import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { HardDrive } from 'lucide-react';
import AssetThumbnail from './AssetThumbnail'; 

interface RichLinkPreviewProps {
  url: string;
}

const RichLinkPreview: React.FC<RichLinkPreviewProps> = ({ url }) => {
  // 🔍 DEBUG: Check what URL is being passed
  useEffect(() => {
     console.log("🔗 [RichLinkPreview] Checking URL:", url);
  }, [url]);

  // 1. Validation (Relaxed: We removed the origin check)
  if (!url || !url.includes('/assets/')) {
      console.warn("⚠️ [RichLinkPreview] URL does not contain /assets/");
      return null;
  }

  // 2. Extract Asset ID using Regex
  // Matches: .../assets/ (capture-uuid-here) ...
  const match = url.match(/\/assets\/([a-zA-Z0-9-]+)/);
  const assetId = match ? match[1] : null;

  if (!assetId) {
      console.warn("⚠️ [RichLinkPreview] Could not extract ID from URL");
      return null;
  }

  // 3. Fetch Asset Data
  const { data: asset, isLoading, isError, error } = useQuery({
    queryKey: ['asset-preview', assetId],
    queryFn: async () => {
      const res = await client.get(`/assets/${assetId}`);
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: false
  });

  if (isLoading) {
    return (
      <div className="mt-2 flex items-center gap-3 p-3 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/10 max-w-sm animate-pulse">
        <div className="w-12 h-12 bg-gray-200 dark:bg-white/10 rounded-lg shrink-0" />
        <div className="space-y-2 flex-1">
            <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-3/4" />
            <div className="h-2 bg-gray-200 dark:bg-white/10 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (isError || !asset) {
      console.error("❌ [RichLinkPreview] Fetch Failed:", error);
      return null;
  }

  // 4. Render The Card
  return (
    <div className="mt-2 group block bg-gray-50 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden max-w-sm transition-all cursor-pointer relative shadow-sm">
        <a href={url} target="_blank" rel="noreferrer" className="absolute inset-0 z-10" />
        
        {/* Decorative Bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />

        <div className="flex p-3 gap-3 pl-4">
            {/* Thumbnail */}
            <div className="w-16 h-16 shrink-0 bg-gray-200 dark:bg-white/5 rounded-lg overflow-hidden border border-gray-200 dark:border-white/5 relative">
                <AssetThumbnail 
                    mimeType={asset.mimeType} 
                    thumbnailPath={asset.thumbnailPath || asset.path} 
                    className="w-full h-full object-cover"
                />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate pr-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {asset.originalName || asset.filename}
                </h4>
                
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    <span className="uppercase font-semibold tracking-wider text-[10px] bg-gray-200 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                        {asset.mimeType.split('/')[1]}
                    </span>
                    <span className="opacity-50">•</span>
                    <span className="flex items-center gap-1">
                       <HardDrive size={10} /> {(asset.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                </div>
            </div>
        </div>
    </div>
  );
};

export default RichLinkPreview;