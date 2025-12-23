import React, { useState, useEffect } from 'react';

interface VideoThumbnailProps {
  mainThumbnail: string;
  previewFrames?: string[];
  alt: string;
  className?: string;
}

const VideoThumbnail = ({ mainThumbnail, previewFrames = [], alt, className }: VideoThumbnailProps) => {
  const [currentFrame, setCurrentFrame] = useState(mainThumbnail);
  const [isActive, setIsActive] = useState(false);
  
  // 1. Preload images so they don't flicker on hover
  useEffect(() => {
    if (previewFrames && previewFrames.length > 0) {
      previewFrames.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    }
  }, [previewFrames]);

  // 2. Calculate which frame to show
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!previewFrames || previewFrames.length === 0) return;

    const { left, width } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - left; 
    
    // Get percentage (0.0 to 1.0)
    const percentage = Math.max(0, Math.min(1, x / width));
    
    // Map to array index (0 to length-1)
    const frameIndex = Math.floor(percentage * previewFrames.length);
    const safeIndex = Math.min(frameIndex, previewFrames.length - 1);
    
    setCurrentFrame(previewFrames[safeIndex]);
  };

  const handleMouseLeave = () => {
    setIsActive(false);
    setCurrentFrame(mainThumbnail); // Snap back to cover
  };

  const handleMouseEnter = () => {
    setIsActive(true);
  };

  return (
    <div 
      className={`relative overflow-hidden w-full h-full ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <img
        src={currentFrame}
        alt={alt}
        className="w-full h-full object-cover transition-none" // No fade transition for snappy scrubbing
        loading="lazy"
      />
      
      {/* Optional Badge */}
      {!isActive && previewFrames && previewFrames.length > 0 && (
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-bold backdrop-blur-sm pointer-events-none">
            VIDEO
        </div>
      )}
    </div>
  );
};

export default VideoThumbnail;