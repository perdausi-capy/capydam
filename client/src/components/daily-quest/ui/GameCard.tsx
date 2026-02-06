export const GameCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`
    bg-white dark:bg-slate-800 
    border-4 border-gray-900 dark:border-slate-600 
    rounded-xl 
    shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.6)]
    transition-colors duration-300
    ${className}
  `}>
    {children}
  </div>
);