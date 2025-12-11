import React, { useState, useEffect } from 'react';
import { Search, X, Image as ImageIcon, Film, FileText } from 'lucide-react';
import ColorFilterBar from './ColorFilterBar';

// Types
export type FilterType = 'image' | 'video' | 'document';

interface DashboardHeaderProps {
  assetsCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterType: FilterType;
  setFilterType: (type: FilterType) => void;
  selectedColor: string | null;
  setSelectedColor: (color: string | null) => void;
}

// Extracted Search Input
const SearchInput = ({ 
  value, 
  onChange, 
  onClear, 
  className = "" 
}: { 
  className?: string, 
  value: string, 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, 
  onClear: () => void 
}) => (
  <div className={`relative w-full ${className}`}>
    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
      <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
    </div>
    <input
      type="text"
      className="block w-full rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 py-2.5 pl-11 pr-10 text-sm text-gray-900 dark:text-white shadow-sm transition-all focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:focus:ring-blue-900/30 outline-none placeholder-gray-400 dark:placeholder-gray-500"
      placeholder="Search assets..."
      value={value}
      onChange={onChange}
    />
    {value && (
      <button 
        onClick={onClear} 
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
);

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  assetsCount,
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  selectedColor,
  setSelectedColor
}) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const offset = window.scrollY;
          setIsScrolled((prev) => {
            if (offset < 10) return false; 
            if (offset > 100) return true;
            return prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const FilterTab = ({ label, type, icon: Icon }: { label: string, type: FilterType, icon: any }) => (
    <button
      onClick={() => setFilterType(type)}
      className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 whitespace-nowrap shrink-0 snap-start
        ${filterType === type 
          ? 'bg-gray-900 text-white shadow-md transform scale-105 dark:bg-white dark:text-gray-900' 
          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 dark:bg-white/5 dark:text-gray-400 dark:border-white/10 dark:hover:bg-white/10 dark:hover:text-white'}
      `}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <div className={`
        sticky top-16 lg:top-0 z-10 w-full 
        bg-[#F2F4F7]/95 dark:bg-[#0B0D0F]/90 backdrop-blur-md 
        border-b border-white/50 dark:border-white/5 
        shadow-sm transition-all duration-500 ease-in-out
        px-4 lg:px-8 py-4
        ${/* ✅ FIX: Removed will-change-transform from here */ ''}
    `}>
      <div className="max-w-[2000px] mx-auto flex flex-col transition-all duration-500 gap-0 relative">
        
        {/* ROW 1: Title & Initial Search */}
        <div 
            className={`
                flex flex-col md:flex-row md:items-center justify-between gap-4 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
                ${isScrolled ? 'max-h-0 opacity-0 mb-0 -translate-y-2' : 'max-h-40 opacity-100 mb-5 translate-y-0'}
            `}
        >
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight transition-colors">Asset Library</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1 ml-0.5 transition-colors">
                {assetsCount} {assetsCount === 1 ? 'item' : 'items'} found
              </p>
            </div>

            <div className="w-full md:max-w-md">
                <SearchInput 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  onClear={() => setSearchQuery('')}
                />
            </div>
        </div>

        {/* ROW 2: Filters, Center Search, Colors */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 overflow-visible relative">
            
            <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 px-1 -mx-1 no-scrollbar mask-gradient-right snap-x z-20">
                <FilterTab label="Images" type="image" icon={ImageIcon} />
                <FilterTab label="Videos" type="video" icon={Film} />
                <FilterTab label="Documents" type="document" icon={FileText} />
            </div>

            {/* Center: Search Bar */}
            <div 
                className={`
                    absolute left-0 right-0 mx-auto transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] z-10 flex justify-center
                    ${isScrolled 
                        ? 'opacity-100 translate-y-0 pointer-events-auto w-full lg:max-w-md' 
                        : 'opacity-0 -translate-y-4 pointer-events-none w-1/2'
                    }
                    hidden lg:flex
                `}
            >
                 <SearchInput 
                    className="shadow-md"
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    onClear={() => setSearchQuery('')}
                  />
            </div>

            <div className="pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-200 dark:border-white/10 w-full lg:w-auto overflow-hidden z-20">
                <ColorFilterBar 
                    selectedColor={selectedColor} 
                    onSelectColor={setSelectedColor} 
                />
            </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;