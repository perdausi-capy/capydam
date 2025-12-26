import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Download, FolderPlus, ExternalLink } from 'lucide-react';
import AssetThumbnail from './AssetThumbnail';

// --- TYPES ---
interface Asset {
  id: string;
  filename: string;
  thumbnailPath: string | null;
  mimeType: string;
  originalName: string;
  path: string;
  aiData?: string;
  previewFrames?: string[];
  uploadedBy?: { name: string };
}

interface AssetCardProps {
    asset: Asset;
    index: number;
    onClick?: (id: string, idx: number) => void;
    onDownload?: (e: React.MouseEvent, asset: any) => void; 
    onAddToCollection?: (e: React.MouseEvent, id: string) => void;
}

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

const cleanFilename = (name: string) => {
    if (!name) return "Untitled";
    let clean = name.replace(/\.[^/.]+$/, "");
    if (clean.length > 25) return clean.substring(0, 25) + "...";
    return clean;
};

// --- COMPONENT ---
const AssetCard = React.memo(({ asset, index, onClick, onDownload, onAddToCollection }: AssetCardProps) => {
    const { tags, link } = useMemo(() => parseAiData(asset.aiData), [asset.aiData]);

    return (
        // transform-gpu forces hardware acceleration (Smoother scrolling)
        <div className="group relative mb-6 block transition-all duration-300 w-full min-w-0 transform-gpu break-inside-avoid">
            <div className="relative">
                {/* Visuals: Flat design, no hover lift, subtle border */}
                <div className="relative w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#1A1D21] shadow-sm border border-gray-100 dark:border-white/5">
                    
                    <Link to={`/assets/${asset.id}`} className="block cursor-pointer relative" onClick={() => onClick?.(asset.id, index)}>
                        
                        {/* 🌑 DARKEN OVERLAY: Fades in black/20 on hover */}
                        <div className="absolute inset-0 z-10 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 pointer-events-none" />
                        
                        <div className="transition-opacity">
                            <AssetThumbnail 
                                mimeType={asset.mimeType} 
                                thumbnailPath={asset.thumbnailPath || asset.path} 
                                previewFrames={asset.previewFrames}
                                className="w-full h-auto"
                            />
                        </div>
                    </Link>
                </div>

                {/* Hover Actions */}
                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
                    {link && (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-indigo-500 dark:text-indigo-400 shadow-sm backdrop-blur-md hover:bg-indigo-600 hover:text-white" onClick={(e) => e.stopPropagation()}>
                            <ExternalLink size={16} />
                        </a>
                    )}
                    {onAddToCollection && (
                        <button onClick={(e) => onAddToCollection(e, asset.id)} className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-indigo-600 dark:text-indigo-400 shadow-sm backdrop-blur-md hover:bg-indigo-600 hover:text-white">
                            <FolderPlus size={16} />
                        </button>
                    )}
                    {onDownload && (
                        <button onClick={(e) => onDownload(e, asset)} className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-md hover:bg-blue-600 hover:text-white">
                            <Download size={16} />
                        </button>
                    )}
                </div>
            </div>
            
            {/* Meta Info */}
            <div className="mt-3 px-1 w-full min-w-0">
                <Link to={`/assets/${asset.id}`} onClick={() => onClick?.(asset.id, index)} className="group/link block w-full">
                    <p className="truncate font-bold text-sm text-gray-800 dark:text-gray-100 group-hover/link:underline decoration-gray-400 underline-offset-2 transition-all w-full block">
                        {cleanFilename(asset.originalName)}
                    </p>
                </Link>
                <div className="mt-1.5 flex flex-wrap gap-1.5 h-auto overflow-hidden opacity-70 hover:opacity-100 transition-opacity">
                    {tags.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="text-[10px] text-gray-500 dark:text-gray-400 font-medium bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                            #{tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}, 
// STRICT COMPARATOR: Only re-render if ID changes. Ignores function prop changes.
(prev, next) => prev.asset.id === next.asset.id);

export default AssetCard;