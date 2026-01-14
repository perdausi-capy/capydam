import React, { useEffect, useState } from 'react';
import { Search, Grid, Sparkles, Image as ImageIcon, Film, Plus } from 'lucide-react';

// 1. Define Filter Types
export type FilterType = 'all' | 'image' | 'video';

// 2. Add 'onAddAsset' to the interface
interface DashboardHeaderJrdProps {
  assetsCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterType: FilterType;
  setFilterType: (type: FilterType) => void;
  onAddAsset: () => void; // ✅ Required: Function to open modal
}

const DashboardHeaderJrd: React.FC<DashboardHeaderJrdProps> = React.memo(({
  assetsCount,
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  onAddAsset // ✅ Receive the function
}) => {
  
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScroll = window.scrollY;
          setIsScrolled((prev) => {
            if (currentScroll > 50) return true;
            if (currentScroll < 10) return false;
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
            ? 'bg-white/95 dark:bg-[#1A1D21]/95 backdrop-blur-xl py-3 shadow-md' 
            : 'bg-[#F3F4F6] dark:bg-[#0B0D0F] py-6 border-transparent'
        }`}
    >
      <div className="px-4 lg:px-8 max-w-[2000px] mx-auto relative flex flex-col gap-4">
        
        {/* --- TOP ROW: Title & ADD BUTTON --- */}
        <div 
            className={`flex items-center justify-between transition-all duration-300 ease-in-out ${
                isScrolled ? 'max-h-0 opacity-0 -mb-4 overflow-hidden' : 'max-h-24 opacity-100 mb-2'
            }`}
        >
            {/* Title Section */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2 whitespace-nowrap">
                    JRD Library <Sparkles size={16} className="text-yellow-500 fill-yellow-500" />
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 whitespace-nowrap">
                    {assetsCount} {assetsCount === 1 ? 'item' : 'items'} found
                </p>
            </div>

          
        </div>

        {/* --- BOTTOM ROW: Controls --- */}
        <div className="flex items-center gap-4 w-full">
          
       

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
                    
                    {/* 1. LEFT: Type Filters */}
                    <div className={`transition-all duration-300 ${isScrolled ? 'scale-95 origin-left' : 'scale-100'}`}>
                        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl overflow-x-auto max-w-full no-scrollbar">
                          <button onClick={() => setFilterType('all')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'all' ? 'bg-white dark:bg-[#2C3035] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                            <Grid size={14} /> All
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
            {/* ✅ THE MISSING BUTTON */}
                        <button 
                            onClick={onAddAsset}
                            className="group flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300"
                        >
                            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                            <span className="hidden sm:inline">Add Asset</span>
                        </button>   
               
          
                  </div>
        </div>
      </div>
    </div>
  );
});

export default DashboardHeaderJrd;