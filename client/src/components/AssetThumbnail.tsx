import React from 'react';
import { FileText, Film, Music, File } from 'lucide-react';

interface Props {
  mimeType: string;
  thumbnailPath: string | null;
  className?: string;
}

const AssetThumbnail: React.FC<Props> = ({ mimeType, thumbnailPath, className = "" }) => {
  // 1. If we have a thumbnail (It's an image or video screenshot), show it
  if (thumbnailPath) {
    return (
        <img
        // ✅ FIX: Removed "http://localhost:5000/"
        // The DB now holds the full Supabase URL (https://...)
        src={thumbnailPath}
        alt="Thumbnail"
        className={`block w-full h-auto object-cover ${className}`} 
        loading="lazy"
        decoding="async"
        />
    );
  }

  // 2. If no thumbnail, show a nice icon based on type
  let Icon = File; // Default
  let colorClass = "bg-gray-100 text-gray-500";

  if (mimeType.startsWith('video/')) {
    Icon = Film;
    colorClass = "bg-red-50 text-red-500";
  } else if (mimeType.startsWith('audio/')) {
    Icon = Music;
    colorClass = "bg-purple-50 text-purple-500";
  } else if (mimeType.includes('pdf')) {
    Icon = FileText;
    colorClass = "bg-orange-50 text-orange-500";
  }

  return (
    <div 
      className={`
        flex w-full items-center justify-center 
        ${colorClass} 
        ${className}
        h-56            // Force a nice height for icons
        lg:h-64         // Taller on desktop
      `}
    >
      <div className="flex flex-col items-center gap-2">
        <Icon size={64} strokeWidth={1} className="opacity-80" />
        <span className="text-xs font-bold uppercase tracking-wider opacity-60">
            {mimeType.split('/')[1].toUpperCase()}
        </span>
      </div>
    </div>
  );
};

export default AssetThumbnail;