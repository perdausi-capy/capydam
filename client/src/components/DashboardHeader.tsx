import React, { useEffect, useState, useMemo } from 'react';
import { Search, Image as ImageIcon, Film, Music, Grid, Sparkles } from 'lucide-react';

export type FilterType = 'all' | 'image' | 'video' | 'audio';

interface DashboardHeaderProps {
  assetsCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterType: FilterType;
  setFilterType: (type: FilterType) => void;
  selectedColor: string | null;
  setSelectedColor: (color: string | null) => void;
}

// Move static data outside to prevent recreation
const COLORS = [
  { name: 'Red', class: 'bg-red-500' },
  { name: 'Orange', class: 'bg-orange-500' },
  { name: 'Yellow', class: 'bg-yellow-400' },
  { name: 'Green', class: 'bg-green-500' },
  { name: 'Blue', class: 'bg-blue-500' },
  { name: 'Purple', class: 'bg-purple-500' },
  { name: 'Pink', class: 'bg-pink-500' },
  { name: 'Black', class: 'bg-black' },
  { name: 'White', class: 'bg-white border border-gray-200' },
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

  // --- ⚡ OPTIMIZED SCROLL LISTENER ---
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Only update state if value actually changes to prevent re-renders
          const shouldBeScrolled = window.scrollY > 10;
          setIsScrolled(prev => {
              if (prev !== shouldBeScrolled) return shouldBeScrolled;
              return prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };

    // { passive: true } improves scrolling performance massively
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
        
        {/* --- TOP ROW: Title & Stats --- */}
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

        {/* --- BOTTOM ROW: Filters + Search --- */}
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
                <button onClick={() => setFilterType('audio')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'audio' ? 'bg-white dark:bg-[#2C3035] text-yellow-600 dark:text-yellow-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-yellow-500'}`}>
                  <Music size={14} /> Audio
                </button>
              </div>
          </div>

          {/* 2. MIDDLE: Search Bar */}
          <div 
            className={`
                transition-all duration-300 ease-in-out z-20
                ${isScrolled 
                    ? 'relative w-full max-w-xl mx-4 order-last md:order-none' 
                    : 'w-full md:absolute md:top-6 md:right-4 lg:md:right-8 md:w-96'
                }
            `}
          >
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={18} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  className={`
                    block w-full pl-10 pr-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm
                    ${isScrolled ? 'py-2 bg-white dark:bg-black/40' : 'py-2.5'}
                  `}
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
          </div>

          {/* 3. RIGHT: Color Filter */}
          <div className={`transition-all duration-300 ${isScrolled ? 'scale-95 origin-right' : 'scale-100'}`}>
              <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 md:pb-0 no-scrollbar">
                {selectedColor && (
                    <button onClick={() => setSelectedColor(null)} className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider bg-gray-200 dark:bg-white/10 rounded-full hover:bg-gray-300 dark:hover:bg-white/20 transition-colors">Clear</button>
                )}
                {COLORS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(selectedColor === color.name ? null : color.name)}
                    className={`h-6 w-6 rounded-full transition-all duration-300 ${color.class} ${selectedColor === color.name ? 'ring-2 ring-offset-2 ring-blue-500 scale-110 dark:ring-offset-[#1A1D21]' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                    title={color.name}
                  />
                ))}
              </div>
          </div>

        </div>
      </div>
    </div>
  );
});

export default DashboardHeader;