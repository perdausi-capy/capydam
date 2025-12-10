import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext'; // Import Auth
import { 
    Folder, Plus, Loader2, Search, LayoutGrid, List, FolderOpen, Image as ImageIcon, Calendar 
} from 'lucide-react';
import { toast } from 'react-toastify';

interface Collection {
  id: string;
  name: string;
  createdAt?: string; 
  _count: { assets: number };
  coverImage?: string; 
}

const Collections = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth(); // Get User
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  // PERMISSION: Only Admin/Editor can create
  const canCreate = user?.role === 'admin' || user?.role === 'editor';

  const fetchCollections = async () => {
    try {
      const { data } = await client.get('/collections');
      setCollections(data);
    } catch (error) {
      toast.error("Failed to load collections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      await client.post('/collections', { name: newCollectionName });
      toast.success(`Collection "${newCollectionName}" created`);
      setNewCollectionName('');
      setIsCreating(false);
      fetchCollections(); 
    } catch (error) {
      toast.error('Failed to create collection');
    }
  };

  const filteredCollections = collections.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="flex h-[50vh] items-center justify-center dark:bg-[#0B0D0F]"><Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={40} /></div>;

  return (
    <div className="min-h-screen p-6 md:p-8 bg-[#F3F4F6] dark:bg-[#0B0D0F] transition-colors duration-500">
      
      {/* HEADER */}
      <div className="mx-auto max-w-7xl mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Collections</h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">Organize your assets into managed folders.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full md:w-64 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 pl-10 pr-4 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all shadow-sm"
              />
            </div>

            <div className="hidden md:flex items-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-1 shadow-sm">
              <button onClick={() => setViewMode('grid')} className={`rounded-md p-1.5 transition-all ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}><LayoutGrid size={18} /></button>
              <button onClick={() => setViewMode('list')} className={`rounded-md p-1.5 transition-all ${viewMode === 'list' ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}><List size={18} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* GRID */}
      <div className="mx-auto max-w-7xl">
        <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>

            {/* PERMISSION: Hide Create Card if Viewer */}
            {canCreate && (
                <div 
                    onClick={() => setIsCreating(true)}
                    className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 transition-all hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 hover:shadow-md 
                    ${viewMode === 'list' ? 'h-24 flex-row justify-start px-6 gap-4' : 'aspect-[4/3] min-h-[220px]'}`}
                >
                    {isCreating ? (
                        <form onSubmit={handleCreate} className="w-full px-6" onClick={(e) => e.stopPropagation()}>
                            <label className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase mb-1 block">New Collection</label>
                            <input
                                autoFocus
                                type="text"
                                placeholder="Name..."
                                value={newCollectionName}
                                onChange={(e) => setNewCollectionName(e.target.value)}
                                onBlur={() => !newCollectionName && setIsCreating(false)}
                                className="w-full rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-black/20 px-3 py-2 text-center text-sm font-medium text-gray-900 dark:text-white outline-none ring-4 ring-blue-100 dark:ring-blue-900/30 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                            />
                            <button type="submit" className="hidden">Create</button>
                            <p className="mt-2 text-center text-[10px] text-gray-400">Press Enter to save</p>
                        </form>
                    ) : (
                        <>
                            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-gray-200 dark:ring-white/10 transition-transform group-hover:scale-110 group-hover:shadow-md"><Plus size={28} /></div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Create New</h3>
                        </>
                    )}
                </div>
            )}

            {/* LIST */}
            {filteredCollections.map((col) => (
                <Link to={`/collections/${col.id}`} key={col.id} className={`group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1D21] shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-900 ${viewMode === 'list' ? 'flex items-center gap-4 p-4 h-24' : 'flex flex-col aspect-[4/3] min-h-[220px]'}`}>
                    {viewMode === 'grid' && (
                        <div className="relative flex-1 w-full overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-white/5 dark:to-white/10 flex items-center justify-center">
                            {col.coverImage ? (
                                <><img src={col.coverImage} alt={col.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" /><div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" /></>
                            ) : (<FolderOpen size={64} className="text-blue-100 dark:text-white/10 group-hover:text-blue-200 dark:group-hover:text-white/20 transition-colors" strokeWidth={1.5} />)}
                            <div className="absolute top-3 right-3 rounded-full bg-white/90 dark:bg-black/60 px-2.5 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-sm border border-transparent dark:border-white/10">{col._count.assets}</div>
                        </div>
                    )}
                    <div className={`flex items-center justify-between ${viewMode === 'grid' ? 'p-4 border-t border-gray-50 dark:border-white/5 h-20' : 'w-full'}`}>
                        <div className="flex items-center gap-4">
                            {viewMode === 'list' && <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"><Folder size={24} /></div>}
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-[180px]">{col.name}</h3>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    <span className="flex items-center gap-1"><ImageIcon size={12} /> {col._count.assets} items</span>
                                    {col.createdAt && <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(col.createdAt).toLocaleDateString()}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Collections;