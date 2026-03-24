import React, { useState, useRef, useEffect } from 'react';
import { Search, Image as ImageIcon, Film, Grid, Sparkles, X, Palette, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  { name: 'Red', hex: 'bg-rose-500', border: 'border-rose-200 dark:border-rose-800' },
  { name: 'Orange', hex: 'bg-orange-500', border: 'border-orange-200 dark:border-orange-800' },
  { name: 'Brown', hex: 'bg-amber-800', border: 'border-amber-600 dark:border-amber-900' },
  { name: 'Yellow', hex: 'bg-yellow-400', border: 'border-yellow-200 dark:border-yellow-700' },
  { name: 'Green', hex: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800' },
  { name: 'Teal', hex: 'bg-teal-500', border: 'border-teal-200 dark:border-teal-800' },
  { name: 'Blue', hex: 'bg-sky-500', border: 'border-sky-200 dark:border-sky-800' },
  { name: 'Navy', hex: 'bg-blue-900', border: 'border-blue-700 dark:border-blue-950' },
  { name: 'Purple', hex: 'bg-violet-500', border: 'border-violet-200 dark:border-violet-800' },
  { name: 'Pink', hex: 'bg-pink-500', border: 'border-pink-200 dark:border-pink-800' },
  { name: 'Gray', hex: 'bg-gray-500', border: 'border-gray-300 dark:border-gray-700' },
  { name: 'Black', hex: 'bg-zinc-900', border: 'border-zinc-700 dark:border-zinc-950' },
  { name: 'White', hex: 'bg-white', border: 'border-gray-200 dark:border-gray-600' },
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
  const [showColorMenu, setShowColorMenu] = useState(false);
  const colorMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorMenuRef.current && !colorMenuRef.current.contains(event.target as Node)) {
        setShowColorMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeColorObj = COLORS.find(c => c.name === selectedColor);

  // Helper to render filter buttons uniformly
  const renderFilterButtons = () => (
    <>
      <button onClick={() => setFilterType('all')} className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2 lg:py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'all' ? 'bg-white dark:bg-[#2C3035] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
        <Grid size={14} /> All
      </button>
      <button onClick={() => setFilterType('image')} className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2 lg:py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'image' ? 'bg-white dark:bg-[#2C3035] text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400'}`}>
        <ImageIcon size={14} /> Images
      </button>
      <button onClick={() => setFilterType('video')} className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2 lg:py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'video' ? 'bg-white dark:bg-[#2C3035] text-pink-600 dark:text-pink-400 shadow-sm' : 'text-gray-500 hover:text-pink-600 dark:text-gray-400 dark:hover:text-pink-400'}`}>
        <Film size={14} /> Videos
      </button>
    </>
  );

  return (
    // ✅ Responsive Sticky Positioning
    <header className="sticky top-16 lg:top-0 z-30 border-b border-gray-200 dark:border-white/5 bg-white/90 dark:bg-[#1A1D21]/90 backdrop-blur-xl transition-colors duration-300">
      <div className="w-full px-4 lg:px-8 py-3 lg:py-0 lg:h-16 max-w-[2000px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-3">
        
        {/* ROW 1 (Mobile) / ENTIRE ROW (Desktop) */}
        <div className="flex items-center justify-between w-full gap-3">
            
            {/* 1. Title (Hidden on Mobile) */}
            <div className="hidden lg:flex items-center gap-3 w-1/4 shrink-0 min-w-fit">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
                    Library <Sparkles size={16} className="text-yellow-500 fill-yellow-500" />
                </h1>
                <div className="h-4 w-px bg-gray-300 dark:bg-white/10" />
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-2.5 py-0.5 rounded-full">
                    {assetsCount}
                </span>
            </div>

            {/* 2. Segments (Hidden on Mobile - moved to row 2) */}
            <div className="hidden lg:flex p-1 bg-gray-100 dark:bg-[#0B0D0F] rounded-xl border border-gray-200 dark:border-white/5 shadow-inner">
               {renderFilterButtons()}
            </div>

            {/* 3. Search Bar */}
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                className="block w-full pl-9 pr-4 py-2.5 lg:py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm focus:bg-white dark:focus:bg-black/40"
                placeholder="Search assets, tags, or IDs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      <X size={14} />
                  </button>
              )}
            </div>

            {/* 4. Palette Dropdown */}
            <div className="shrink-0 lg:w-1/4 flex justify-end relative" ref={colorMenuRef}>
                <div className="flex items-center gap-2">
                    {selectedColor && activeColorObj && (
                        <button onClick={() => setSelectedColor(null)} className="hidden sm:flex items-center gap-1.5 pl-1.5 pr-3 py-1 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-xs font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10">
                            <div className={`w-4 h-4 rounded-full border ${activeColorObj.border} ${activeColorObj.hex}`} />
                            <X size={12} className="opacity-60" />
                        </button>
                    )}
                    <button
                        onClick={() => setShowColorMenu(!showColorMenu)}
                        className={`p-2.5 lg:p-2 rounded-xl border transition-all ${showColorMenu || selectedColor ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 dark:bg-white/5 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'}`}
                        title="Filter by Color"
                    >
                        <Palette size={18} />
                    </button>
                </div>

                <AnimatePresence>
                    {showColorMenu && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.15 }}
                            className="absolute top-14 right-0 w-64 bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 z-50 origin-top-right"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Color Palette</span>
                                {selectedColor && (
                                    <button onClick={() => { setSelectedColor(null); setShowColorMenu(false); }} className="text-[10px] font-bold text-blue-500 hover:underline">Clear</button>
                                )}
                            </div>
                            <div className="grid grid-cols-5 gap-3">
                                {COLORS.map((color) => {
                                    const isActive = selectedColor === color.name;
                                    const isLight = color.name === 'White' || color.name === 'Yellow';
                                    return (
                                        <button
                                            key={color.name}
                                            onClick={() => { setSelectedColor(isActive ? null : color.name); setShowColorMenu(false); }}
                                            title={color.name}
                                            className={`relative w-8 h-8 rounded-full border shadow-sm transition-all duration-200 flex items-center justify-center ${color.hex} ${color.border} ${isActive ? 'scale-110 ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-[#1A1D21]' : 'hover:scale-110 hover:shadow-md'}`}
                                        >
                                            {isActive && <Check size={14} strokeWidth={4} className={isLight ? 'text-gray-900' : 'text-white'} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>

        {/* ROW 2 (Mobile Only) - Segments */}
        <div className="flex lg:hidden w-full overflow-x-auto no-scrollbar">
            <div className="flex w-full p-1 bg-gray-100 dark:bg-[#0B0D0F] rounded-xl border border-gray-200 dark:border-white/5 shadow-inner">
               {renderFilterButtons()}
            </div>
        </div>

      </div>
    </header>
  );
});

export default DashboardHeader;