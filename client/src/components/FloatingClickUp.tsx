import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import clickUpLogo from '../assets/clickuplogo2.png';

const FloatingClickUp = () => {
    const [isVisible] = useState(true);

    if (!isVisible) return null;

    return (
        // Anchored at bottom-right, justifying flex items to the end forces it to expand to the left!
        <div className="fixed bottom-36 right-8 z-40 flex items-center justify-end group">
            <div className="relative flex justify-end">
                
                <a  
                    href="https://app.clickup.com/t/86euevnrn" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center overflow-hidden whitespace-nowrap rounded-full hover:rounded-2xl bg-white/90 dark:bg-[#1A1D21]/90 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg hover:shadow-xl hover:border-purple-300 dark:hover:border-purple-500/50 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] w-12 hover:w-[240px] h-12 hover:h-[60px] px-1.5 hover:px-3"
                >
                    {/* 🎯 ICON: Removed grayscale and opacity filters! Now it's always full color */}
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center group-hover:bg-purple-50 dark:group-hover:bg-purple-900/20 rounded-full group-hover:rounded-xl transition-all duration-500">
                        <img 
                            src={clickUpLogo} 
                            alt="ClickUp" 
                            className="w-8 h-8 object-contain group-hover:scale-110 transition-all duration-500" 
                        />
                    </div>
                    
                    {/* 📝 TEXT CONTENT: Hidden initially, slides in and fades up on hover */}
                    <div className="flex items-center justify-between w-[180px] shrink-0 pl-3 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500 delay-75 pointer-events-none group-hover:pointer-events-auto">
                        <div className="flex flex-col justify-center">
                            <h3 className="text-[13px] font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors leading-tight">
                                Find Task Card
                            </h3>
                            <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-0.5 leading-tight">
                                Open Workspace
                            </p>
                        </div>
                        
                        <div className="p-1.5 rounded-full bg-gray-50 dark:bg-black/20 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                            <ExternalLink size={14} className="text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                        </div>
                    </div>
                </a>

                {/* ❌ Tiny Dismiss Button */}
                {/* <button 
                    onClick={(e) => {
                        e.preventDefault();
                        setIsVisible(false);
                    }}
                    className="absolute -top-2 -right-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full p-1 border border-gray-200 dark:border-gray-700 shadow-sm opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 z-10"
                    title="Hide ClickUp Link"
                >
                    <X size={12} strokeWidth={3} />
                </button> */}
            </div>
        </div>
    );
};

export default FloatingClickUp;