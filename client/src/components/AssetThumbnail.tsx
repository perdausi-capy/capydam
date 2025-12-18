import React from 'react';
import { FileText, Film, Music, File } from 'lucide-react';

// ✅ 1. Allow this component to accept standard <img> props (onLoad, loading, etc.)
interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  mimeType: string;
  thumbnailPath: string | null;
  className?: string;
}

const AssetThumbnail: React.FC<Props> = ({ 
    mimeType, 
    thumbnailPath, 
    className = "", 
    ...imgProps // ✅ 2. Capture extra props here
}) => {
  
  // 3. If we have a thumbnail, show it
  if (thumbnailPath) {
    return (
        <img
          src={thumbnailPath}
          alt="Thumbnail"
          // Merge your classNames with the passed ones
          className={`block w-full h-auto object-cover ${className}`} 
          
          // Defaults (can be overridden by imgProps)
          loading="lazy"
          decoding="async"
          
          // ✅ 4. Spread the extra props (like onLoad) onto the actual img tag
          {...imgProps}
        />
    );
  }

  // 4. If no thumbnail, show a nice icon based on type
  let Icon = File;
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

  // Note: We don't spread imgProps here because this isn't an <img> tag.
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
            {mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
        </span>
      </div>
    </div>
  );
};

export default AssetThumbnail;