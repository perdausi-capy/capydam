import React, { useEffect, useState } from 'react';
import { Search, Image as ImageIcon, Film, Grid, Sparkles, X } from 'lucide-react';

export type FilterType = 'all' | 'image' | 'video';

interface DashboardHeaderProps {
  assetsCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterType: FilterType;
  setFilterType: (type: FilterType) => void;
  selectedColor: string | null;
  setSelectedColor: (color: string | null) => void;
}

const COLORS = [
  { name: 'Red', class: 'bg-rose-500', border: 'border-rose-200' },
  { name: 'Orange', class: 'bg-orange-500', border: 'border-orange-200' },
  { name: 'Brown', class: 'bg-amber-800', border: 'border-amber-600' },
  { name: 'Yellow', class: 'bg-yellow-400', border: 'border-yellow-200' },
  { name: 'Green', class: 'bg-emerald-500', border: 'border-emerald-200' },
  { name: 'Teal', class: 'bg-teal-500', border: 'border-teal-200' },
  { name: 'Blue', class: 'bg-sky-500', border: 'border-sky-200' },
  { name: 'Navy', class: 'bg-blue-900', border: 'border-blue-700' },
  { name: 'Purple', class: 'bg-violet-500', border: 'border-violet-200' },
  { name: 'Pink', class: 'bg-pink-500', border: 'border-pink-200' },
  { name: 'Gray', class: 'bg-gray-500', border: 'border-gray-300' },
  { name: 'Black', class: 'bg-zinc-900', border: 'border-zinc-700' },
  { name: 'White', class: 'bg-white', border: 'border-gray-200' },
];

const DashboardHeader: React.FC<DashboardHeaderProps> = React.memo(({
  assetsCount,
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  selectedColor,
  setSelectedColor
}) => {
  
  const [isScrolled, setIsScrolled] = useState(false);

  // ✅ FIXED: Scroll Listener with Hysteresis
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScroll = window.scrollY;
          
          setIsScrolled((prev) => {
            // Collapse header only after scrolling down a bit (50px)
            if (currentScroll > 50) return true;
            // Expand header only when really close to top (10px)
            if (currentScroll < 10) return false;
            // Otherwise, stay as is (prevents flickering)
            return prev;
          });

          ticking = false;
        });
        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div 
        className={`sticky top-0 z-30 transition-all duration-300 ease-in-out border-b border-gray-200 dark:border-white/5
        ${isScrolled 
            ? 'bg-white/95 dark:bg-[#1A1D21]/95 backdrop-blur-xl py-2 shadow-sm' 
            : 'bg-white/80 dark:bg-[#1A1D21]/80 backdrop-blur-md py-6'
        }`}
    >
      <div className="px-4 lg:px-8 max-w-[2000px] mx-auto relative">
        
        {/* TOP ROW: Title */}
        <div 
            className={`flex flex-col justify-center transition-all duration-300 ease-in-out overflow-hidden ${
                isScrolled ? 'max-h-0 opacity-0 mb-0' : 'max-h-24 opacity-100 mb-6'
            }`}
        >
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2 whitespace-nowrap">
                    Asset Library <Sparkles size={16} className="text-yellow-500" />
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 whitespace-nowrap">
                    {assetsCount} {assetsCount === 1 ? 'item' : 'items'} found
                </p>
            </div>
        </div>

        {/* BOTTOM ROW: Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
          
          {/* 1. LEFT: Type Filters */}
          <div className={`transition-all duration-300 ${isScrolled ? 'scale-95 origin-left' : 'scale-100'}`}>
              <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl overflow-x-auto max-w-full no-scrollbar">
                <button onClick={() => setFilterType('all')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'all' ? 'bg-white dark:bg-[#2C3035] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  <Grid size={14} /> All
                </button>
                <button onClick={() => setFilterType('image')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'image' ? 'bg-white dark:bg-[#2C3035] text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-purple-500'}`}>
                  <ImageIcon size={14} /> Images
                </button>
                <button onClick={() => setFilterType('video')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'video' ? 'bg-white dark:bg-[#2C3035] text-pink-600 dark:text-pink-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-pink-500'}`}>
                  <Film size={14} /> Videos
                </button>
              </div>
          </div>

          {/* 2. MIDDLE: Search Bar */}
          <div className={`transition-all duration-300 ease-in-out z-20 ${isScrolled ? 'relative w-full max-w-xl mx-4 order-last md:order-none' : 'w-full md:absolute md:top-6 md:right-4 lg:md:right-8 md:w-96'}`}>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={18} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  className={`block w-full pl-10 pr-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm ${isScrolled ? 'py-2 bg-white dark:bg-black/40' : 'py-2.5'}`}
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
          </div>

          {/* 3. RIGHT: Color Filter */}
          <div className={`transition-all duration-300 ${isScrolled ? 'scale-95 origin-right' : 'scale-100'}`}>
              <div className="flex items-center gap-3 overflow-x-auto max-w-full pb-1 md:pb-0 no-scrollbar px-1">
                {selectedColor && (
                    <button 
                        onClick={() => setSelectedColor(null)} 
                        className="flex items-center gap-1 h-7 px-3 text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-white/20 transition-colors whitespace-nowrap"
                    >
                        <X size={12} /> Clear
                    </button>
                )}
                
                <div className="flex items-center gap-2 p-1.5 bg-gray-100 dark:bg-white/5 rounded-full">
                    {COLORS.map((color) => (
                    <button
                        key={color.name}
                        onClick={() => setSelectedColor(selectedColor === color.name ? null : color.name)}
                        className={`
                            relative h-6 w-6 rounded-full transition-all duration-300 shadow-sm border
                            ${color.class} 
                            ${selectedColor === color.name 
                                ? `ring-2 ring-offset-2 ring-blue-500 scale-110 z-10 ${color.border}` 
                                : `hover:scale-110 opacity-80 hover:opacity-100 border-transparent hover:border-black/10 dark:hover:border-white/20`
                            }
                            dark:ring-offset-[#1A1D21]
                        `}
                        title={`Filter by ${color.name}`}
                    >
                        {selectedColor === color.name && (
                            <span className="absolute inset-0 flex items-center justify-center">
                                <span className="h-1.5 w-1.5 bg-white rounded-full shadow-sm" />
                            </span>
                        )}
                    </button>
                    ))}
                </div>
              </div>
          </div>

        </div>
      </div>
    </div>
  );
});

export default DashboardHeader;