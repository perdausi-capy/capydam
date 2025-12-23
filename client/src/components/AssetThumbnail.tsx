import React from 'react';
import { FileText, Film, Music, File, Image as ImageIcon } from 'lucide-react';
import VideoThumbnail from './VideoThumbnail';

// ✅ 1. Props Interface: Includes standard <img> props + our custom ones
interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  mimeType: string;
  thumbnailPath: string | null;
  previewFrames?: string[]; // ✅ Added for video scrubbing support
  className?: string;
}

const AssetThumbnail: React.FC<Props> = ({ 
    mimeType, 
    thumbnailPath, 
    previewFrames, 
    className = "", 
    ...imgProps // ✅ Capture extra props (alt, onLoad, etc.)
}) => {
  
  // ---------------------------------------------
  // 1. VIDEO HANDLING (With Scrubbing)
  // ---------------------------------------------
  if (mimeType.startsWith('video/') && thumbnailPath) {
    return (
      <VideoThumbnail 
        mainThumbnail={thumbnailPath} 
        previewFrames={previewFrames} 
        alt={imgProps.alt?.toString() || "Video thumbnail"} // Use the alt from props
        className={className} 
      />
    );
  }

  // ---------------------------------------------
  // 2. STANDARD THUMBNAIL (Images, PDFs with thumbs)
  // ---------------------------------------------
  if (thumbnailPath) {
    return (
        <img
          src={thumbnailPath}
          // Merge classNames
          className={`block w-full h-auto object-cover ${className}`} 
          
          // Defaults
          loading="lazy"
          decoding="async"
          
          // ✅ Spread extra props (onLoad, etc.)
          {...imgProps}
        />
    );
  }

  // ---------------------------------------------
  // 3. FALLBACK ICONS (If no thumbnail exists)
  // ---------------------------------------------
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
  } else if (mimeType.startsWith('image/')) {
    Icon = ImageIcon;
    colorClass = "bg-blue-50 text-blue-500";
  }

  return (
    <div 
      className={`
        flex w-full items-center justify-center 
        ${colorClass} 
        ${className}
        h-56 lg:h-64  // Preserving your requested height styles for icons
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