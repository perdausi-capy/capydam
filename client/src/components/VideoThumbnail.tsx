import React, { useState, useRef } from 'react';

interface VideoThumbnailProps {
  mainThumbnail: string;
  previewFrames?: string[];
  alt: string;
  className?: string;
}

const VideoThumbnail = ({ mainThumbnail, previewFrames = [], alt, className }: VideoThumbnailProps) => {
  const [currentFrame, setCurrentFrame] = useState(mainThumbnail);
  const [isActive, setIsActive] = useState(false);
  const hasPreloaded = useRef(false); // ✅ Track if we already downloaded frames
  
  // ✅ FIX: Calculate frame on mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!previewFrames || previewFrames.length === 0) return;

    const { left, width } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - left; 
    
    const percentage = Math.max(0, Math.min(1, x / width));
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
    
    // ✅ FIX: Preload frames ONLY on first hover! Saves massive bandwidth.
    if (!hasPreloaded.current && previewFrames && previewFrames.length > 0) {
      previewFrames.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
      hasPreloaded.current = true;
    }
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
        className="w-full h-full object-cover transition-none"
        loading="lazy"
      />
      
      {!isActive && previewFrames && previewFrames.length > 0 && (
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-bold backdrop-blur-sm pointer-events-none shadow-sm">
            VIDEO
        </div>
      )}
    </div>
  );
};

export default VideoThumbnail;