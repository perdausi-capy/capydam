import React from 'react';
import { FileText, Film, Music, File, Image as ImageIcon } from 'lucide-react';

interface Props {
  mimeType: string;
  thumbnailPath: string | null;
  className?: string;
}

const AssetThumbnail: React.FC<Props> = ({ mimeType, thumbnailPath, className = "" }) => {
  // 1. If we have a thumbnail (It's an image), show it
  if (thumbnailPath) {
    return (
        <img
        src={`http://localhost:5000/${thumbnailPath}`}
        alt="Thumbnail"
        className={`block w-full h-auto ${className}`} // <--- h-auto is key!
        loading="lazy"
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
        h-56            // <--- FIX: Force a nice height (224px)
        lg:h-64         // <--- Taller on desktop
      `}
    >
      <div className="flex flex-col items-center gap-2">
        <Icon size={64} strokeWidth={1} className="opacity-80" />
        {/* Optional label for file type */}
        <span className="text-xs font-bold uppercase tracking-wider opacity-60">
            {mimeType.split('/')[1].toUpperCase()}
        </span>
      </div>
    </div>
  );
};

export default AssetThumbnail;