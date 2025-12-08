import React from 'react';
import { Check, X, Palette } from 'lucide-react';

interface ColorFilterBarProps {
  selectedColor: string | null;
  onSelectColor: (color: string | null) => void;
}

const colorFilters = [
  { name: 'Red', hex: '#ef4444', border: 'border-red-200' },
  { name: 'Orange', hex: '#f97316', border: 'border-orange-200' },
  { name: 'Yellow', hex: '#eab308', border: 'border-yellow-200' },
  { name: 'Green', hex: '#22c55e', border: 'border-green-200' },
  { name: 'Teal', hex: '#14b8a6', border: 'border-teal-200' },
  { name: 'Blue', hex: '#3b82f6', border: 'border-blue-200' },
  { name: 'Purple', hex: '#a855f7', border: 'border-purple-200' },
  { name: 'Pink', hex: '#ec4899', border: 'border-pink-200' },
  { name: 'Black', hex: '#000000', border: 'border-gray-200' },
  { name: 'White', hex: '#ffffff', border: 'border-gray-300' },
  { name: 'Gray', hex: '#6b7280', border: 'border-gray-200' },
];

const ColorFilterBar: React.FC<ColorFilterBarProps> = ({ selectedColor, onSelectColor }) => {
  return (
    <div className="flex items-center gap-3 px-4 mask-gradient">
      
      {/* 1. The "Rainbow" Reset Button */}
      <button
        onClick={() => onSelectColor(null)}
        className={`
          flex items-center justify-center shrink-0 w-6 h-6 rounded-full transition-all duration-300
          ${!selectedColor 
            ? 'bg-gradient-to-tr from-blue-400 via-purple-400 to-orange-400 text-white shadow-md scale-110' 
            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}
        `}
        title="All Colors"
      >
        <Palette size={14} />
      </button>

      <div className="h-6 w-px bg-gray-200 mx-1 shrink-0" />

      {/* 2. Color Dots */}
      {colorFilters.map((c) => {
        const isActive = selectedColor === c.name;
        // Logic to show white checkmark on dark colors, black on light colors
        const isLight = c.name === 'White' || c.name === 'Yellow'; 

        return (
          <button
            key={c.name}
            onClick={() => onSelectColor(isActive ? null : c.name)}
            title={`Filter by ${c.name}`}
            className={`
              group relative flex items-center justify-center shrink-0 w-7 h-7 rounded-full border transition-all duration-300
              ${c.border}
              ${isActive ? 'scale-110 shadow-md ring-2 ring-offset-2 ring-blue-500/30' : 'hover:scale-105 hover:shadow-sm'}
            `}
            style={{ backgroundColor: c.hex }}
          >
            {/* 3. The Checkmark (Only visible when active) */}
            <span className={`
                transition-all duration-200 transform
                ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}
                ${isLight ? 'text-gray-800' : 'text-white'}
            `}>
                <Check size={12} strokeWidth={4} />
            </span>
            
            {/* Optional Tooltip on Hover */}
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              {c.name}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ColorFilterBar;