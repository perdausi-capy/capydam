import { Filter, Calendar, Cpu, Search, X } from 'lucide-react';

export const ITTFilterBar = ({ filters, setFilters, searchTerm, setSearchTerm }: any) => {
    return (
        <div className="flex flex-wrap items-center gap-4 p-4 mb-6 bg-white/60 dark:bg-[#121418] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm backdrop-blur-md">

            {/* 1. Integrated Search Bar */}
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="Search unit or assignee..."
                    className="w-full pl-10 pr-4 py-2 bg-white/50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* 2. Status Filter */}
            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-white/10 pl-4">
                <Filter size={16} className="text-gray-400" />
                <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="select-glass text-xs font-bold uppercase"
                >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="retired">Retired</option>
                </select>
            </div>

            {/* 3. Hardware Spec Filter */}
            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-white/10 pl-4">
                <Cpu size={16} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Hardware..."
                    value={filters.hardware || ''}
                    className="bg-transparent text-xs outline-none dark:text-white w-24"
                    onChange={(e) => setFilters({ ...filters, hardware: e.target.value })}
                />
            </div>

            {/* 4. Black Calendar Button */}
            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-white/10 pl-4">
                <Calendar size={16} className="text-gray-400" />
                <input
                    type="date"
                    value={filters.date || ''}
                    onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                    className="bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-black hover:bg-gray-800 transition-all cursor-pointer"
                />
            </div>

            {/* Reset Everything */}
            {(filters.status || filters.date || filters.hardware || searchTerm) && (
                <button
                    onClick={() => { setFilters({ status: '', date: '', hardware: '' }); setSearchTerm(''); }}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors"
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );
};