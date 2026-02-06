
export const GameButton = ({ onClick, disabled, className, children, variant = 'primary', type = 'button' }: any) => {
  const colors = {
    primary: "bg-indigo-600 hover:bg-indigo-500 border-indigo-900 text-white",
    success: "bg-emerald-600 hover:bg-emerald-500 border-emerald-900 text-white",
    danger: "bg-red-600 hover:bg-red-500 border-red-900 text-white",
    neutral: "bg-gray-200 hover:bg-gray-300 border-gray-400 text-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:border-slate-900 dark:text-slate-200",
    gold: "bg-yellow-500 hover:bg-yellow-400 border-yellow-700 text-black",
  };
  // @ts-ignore
  const colorClass = colors[variant] || colors.primary;

  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled}
      className={`
        relative px-4 py-2 font-bold uppercase tracking-wider text-xs transition-all
        border-b-4 border-r-2 border-l-2 border-t-2 rounded-lg
        active:border-b-2 active:translate-y-1 disabled:opacity-50 disabled:active:translate-y-0
        ${colorClass} ${className}
      `}
    >
      <div className="flex items-center justify-center gap-2">
        {children}
      </div>
    </button>
  );
};