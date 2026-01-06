import React from 'react';
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
  
  // No scroll listeners or state needed anymore. 
  // We lock the style to the "scrolled/compact" version permanently.

  return (
    <div className="sticky top-0 z-30 border-b border-gray-200 dark:border-white/5 bg-white/95 dark:bg-[#1A1D21]/95 backdrop-blur-xl py-3 shadow-sm transition-all">
      <div className="px-4 lg:px-8 max-w-[2000px] mx-auto">
        
        {/* SINGLE ROW: All controls inline */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
          
          {/* 1. LEFT: Title & Type Filters */}
          <div className="flex items-center gap-4 w-full md:w-auto overflow-hidden">
            {/* Compact Title */}
            <div className="hidden lg:flex flex-col min-w-fit">
               <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                   Library <Sparkles size={14} className="text-yellow-500" />
               </h1>
               <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                   {assetsCount} Items
               </span>
            </div>

            {/* Separator for large screens */}
            <div className="hidden lg:block h-8 w-px bg-gray-200 dark:bg-white/10" />

            {/* Filters */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl overflow-x-auto no-scrollbar">
              <button onClick={() => setFilterType('all')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'all' ? 'bg-white dark:bg-[#2C3035] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                <Grid size={14} /> All
              </button>
              <button onClick={() => setFilterType('image')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'image' ? 'bg-white dark:bg-[#2C3035] text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-purple-500'}`}>
                <ImageIcon size={14} /> Images
              </button>
              <button onClick={() => setFilterType('video')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'video' ? 'bg-white dark:bg-[#2C3035] text-pink-600 dark:text-pink-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-pink-500'}`}>
                <Film size={14} /> Videos
              </button>
            </div>
          </div>

          {/* 2. MIDDLE: Search Bar (Takes available space) */}
          <div className="relative w-full md:max-w-md lg:max-w-xl group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                className="block w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm focus:bg-white dark:focus:bg-black/40"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
          </div>

          {/* 3. RIGHT: Color Filter */}
          <div className="w-full md:w-auto flex justify-center md:justify-end">
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
                           relative h-5 w-5 rounded-full transition-all duration-300 shadow-sm border
                           ${color.class} 
                           ${selectedColor === color.name 
                               ? `ring-2 ring-offset-2 ring-blue-500 scale-110 z-10 ${color.border}` 
                               : `hover:scale-110 opacity-80 hover:opacity-100 border-transparent hover:border-black/10 dark:hover:border-white/20`
                           }
                           dark:ring-offset-[#1A1D21]
                       `}
                       title={`Filter by ${color.name}`}
                   />
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