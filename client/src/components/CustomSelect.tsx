import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

export interface Option {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    className?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    required?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, placeholder = "Select...", className = "", icon, disabled = false, required = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Hidden native input for HTML5 form validation */}
            {required && (
                <input
                    type="text"
                    required={required}
                    value={value}
                    onChange={() => {}}
                    className="absolute opacity-0 pointer-events-none w-0 h-0 bottom-0 left-1/2"
                    tabIndex={-1}
                />
            )}
            
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-white/65 dark:bg-white/5 backdrop-blur-xl border rounded-xl px-4 py-2.5 flex items-center justify-between text-sm shadow-sm transition-all focus:ring-2 focus:ring-blue-500 
                    ${disabled ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-white/5' : 'border-gray-300/80 dark:border-white/10 hover:border-blue-500/50'}
                `}
            >
                <div className="flex items-center gap-2 truncate">
                    {icon && <span className="text-gray-500 dark:text-gray-400">{icon}</span>}
                    <span className={`truncate ${!selectedOption ? 'text-gray-500 dark:text-gray-400 font-medium' : 'text-gray-900 dark:text-white font-medium'}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && !disabled && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-[100] top-full left-0 w-full mt-1.5 bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden"
                    >
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
                            {options.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors
                                        ${value === opt.value 
                                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold' 
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 font-medium'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        {opt.icon && <span className="text-gray-400 shrink-0">{opt.icon}</span>}
                                        <span className="truncate">{opt.label}</span>
                                    </div>
                                    {value === opt.value && <Check size={14} className="shrink-0" />}
                                </button>
                            ))}
                            {options.length === 0 && (
                                <div className="px-3 py-3 text-sm text-gray-500 text-center font-medium">No options available</div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomSelect;
