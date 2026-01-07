import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { 
    Folder, 
    Plus, 
    X, 
    Trash2, 
    MoreVertical,
    Edit2,
    Layers, 
    Clock,
    Loader2 
} from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Interface
interface Collection {
  id: string;
  name: string;
  createdAt: string;
  _count: { assets: number };
  coverImage: string | null; 
}

// --- 🦴 SKELETON ---
const CollectionSkeleton = React.memo(() => (
    <div className="flex flex-col rounded-3xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] shadow-sm overflow-hidden h-64">
        <div className="relative flex-1 w-full bg-gray-200 dark:bg-white/5 animate-pulse" />
        <div className="flex items-center justify-between p-5 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#1A1D21]">
            <div className="space-y-2 w-2/3">
                <div className="h-4 bg-gray-200 dark:bg-white/5 rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-gray-200 dark:bg-white/5 rounded w-1/2 animate-pulse" />
            </div>
        </div>
    </div>
));

// --- 💎 MEMOIZED CARD ---
const CollectionCard = React.memo(({ col, onEdit, onDelete }: { col: Collection, onEdit: (e: React.MouseEvent, c: Collection) => void, onDelete: (id: string) => void }) => {
    // ✅ SAFETY LOCK: If ID is temporary (optimistic creation), disable clicks to prevent crash
    const isTemp = col.id.startsWith('temp-');

    return (
        <motion.div 
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isTemp ? 0.7 : 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className={`group relative flex flex-col rounded-3xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden h-64 transform-gpu ${isTemp ? 'cursor-wait' : ''}`}
        >
            {/* ✅ PREVENT NAVIGATION if Temp ID */}
            <Link 
                to={isTemp ? '#' : `/collections/${col.id}`} 
                className={`flex-1 flex flex-col ${isTemp ? 'pointer-events-none' : ''}`}
            >
                {/* COVER AREA */}
                <div 
                    className="relative flex-1 w-full overflow-hidden bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-indigo-900/20 dark:to-blue-900/10 flex items-center justify-center"
                >
                    {/* Show Spinner if Creating */}
                    {isTemp && (
                        <div className="absolute inset-0 z-20 bg-white/50 dark:bg-black/50 flex items-center justify-center">
                            <Loader2 size={32} className="animate-spin text-indigo-600" />
                        </div>
                    )}

                    {col.coverImage ? (
                        <>
                            <img 
                                src={col.coverImage} 
                                alt={col.name} 
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                loading="lazy" 
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                        </>
                    ) : (
                        <div className="p-4 rounded-2xl bg-white/40 dark:bg-white/5 backdrop-blur-sm shadow-inner relative z-10">
                            <Folder size={40} className="text-indigo-500 dark:text-indigo-400 drop-shadow-sm" />
                        </div>
                    )}
                    
                    <div className="absolute top-4 right-4 rounded-full bg-white/90 dark:bg-black/60 px-3 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-md border border-transparent dark:border-white/10 z-10">
                        {col._count?.assets || 0}
                    </div>
                </div>

                {/* FOOTER */}
                <div className="flex items-center justify-between p-5 bg-white dark:bg-[#1A1D21] border-t border-gray-50 dark:border-white/5 relative z-10">
                    <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {col.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
                            <Clock size={12} /> {isTemp ? 'Creating...' : (col.createdAt ? new Date(col.createdAt).toLocaleDateString() : 'Just now')}
                        </div>
                    </div>
                    <div className="h-8 w-8 shrink-0 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-indigo-900/20 dark:group-hover:text-indigo-400 transition-colors">
                        <MoreVertical size={16} />
                    </div>
                </div>
            </Link>

            {/* ACTIONS */}
            {!isTemp && (
                <div className="absolute top-3 left-3 flex gap-2 opacity-0 transform scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 z-20">
                    <button 
                        onClick={(e) => onEdit(e, col)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-black/80 text-gray-600 dark:text-gray-300 shadow-md backdrop-blur-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 transition-colors"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button 
                        onClick={(e) => { e.preventDefault(); onDelete(col.id); }}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-black/80 text-gray-400 dark:text-gray-400 shadow-md backdrop-blur-sm hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )}
        </motion.div>
    );
});

const Collections = () => {
  const queryClient = useQueryClient();
  
  // --- DATA FETCHING ---
  const { data: collections = [], isLoading: loading } = useQuery<Collection[]>({
      queryKey: ['collections'],
      queryFn: async () => {
          const { data } = await client.get('/collections');
          return data;
      },
      staleTime: 1000 * 60 * 5, 
      refetchOnWindowFocus: false,
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // --- 1. CREATE MUTATION (Optimistic) ---
  // We keep creation optimistic because it's usually fast and safe
  const createMutation = useMutation({
      mutationFn: (name: string) => client.post('/collections', { name }),
      
      onMutate: async (newName) => {
          await queryClient.cancelQueries({ queryKey: ['collections'] });
          const previousCollections = queryClient.getQueryData<Collection[]>(['collections']);

          // ⚡️ TEMP ID: Prevents crash by being handled in CollectionCard logic
          const optimisticCollection: Collection = {
              id: `temp-${Date.now()}`,
              name: newName,
              createdAt: new Date().toISOString(),
              _count: { assets: 0 },
              coverImage: null
          };

          queryClient.setQueryData<Collection[]>(['collections'], (old) => {
              return [optimisticCollection, ...(old || [])];
          });

          setIsModalOpen(false);
          setFormName('');

          return { previousCollections };
      },
      onError: (_err, _newName, context) => {
          if (context?.previousCollections) {
              queryClient.setQueryData(['collections'], context.previousCollections);
          }
          toast.error("Failed to create collection");
      },
      onSettled: () => {
          // ⚡️ CRITICAL: Fetch real data to replace Temp ID
          queryClient.invalidateQueries({ queryKey: ['collections'] });
          toast.success("Collection created!");
      }
  });

  // --- 2. UPDATE MUTATION (Optimistic) ---
  const updateMutation = useMutation({
      mutationFn: ({ id, name }: { id: string, name: string }) => client.patch(`/collections/${id}`, { name }),
      onMutate: async ({ id, name }) => {
          await queryClient.cancelQueries({ queryKey: ['collections'] });
          const previousCollections = queryClient.getQueryData<Collection[]>(['collections']);
          queryClient.setQueryData<Collection[]>(['collections'], (old) => 
              old?.map(col => col.id === id ? { ...col, name } : col) || []
          );
          setIsModalOpen(false);
          return { previousCollections };
      },
      onError: (_err, _vars, context) => {
          if (context?.previousCollections) queryClient.setQueryData(['collections'], context.previousCollections);
          toast.error("Update failed");
      },
      onSettled: () => {
          queryClient.invalidateQueries({ queryKey: ['collections'] });
          toast.success("Collection updated!");
      }
  });

  // --- 3. DELETE MUTATION (PESSIMISTIC / WITH LOADER) ---
  // ✅ FIX: We removed `onMutate` (Optimistic Update) here.
  // This keeps the modal OPEN with a spinner while the server works.
  const deleteMutation = useMutation({
      mutationFn: (id: string) => client.delete(`/collections/${id}`),
      onSuccess: () => {
          // Once server says "OK", we refresh the list and close the modal
          queryClient.invalidateQueries({ queryKey: ['collections'] });
          toast.success("Collection deleted");
          setDeleteId(null);
      },
      onError: (_err) => {
          toast.error("Failed to delete. Try again.");
      }
  });

  // Actions
  const openCreate = useCallback(() => { setEditingId(null); setFormName(''); setIsModalOpen(true); }, []);
  const openEdit = useCallback((e: React.MouseEvent, col: Collection) => { e.preventDefault(); setEditingId(col.id); setFormName(col.name); setIsModalOpen(true); }, []);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    if (editingId) updateMutation.mutate({ id: editingId, name: formName });
    else createMutation.mutate(formName);
  };

  const handleDelete = () => {
    if (deleteId) deleteMutation.mutate(deleteId);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] transition-colors duration-500 relative overflow-hidden font-sans">
      
      {/* Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-indigo-400/10 dark:bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-400/10 dark:bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      {/* HEADER */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 pt-12 pb-12 px-8 border-b border-gray-200/50 dark:border-white/5 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-6">
              <div>
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm tracking-wider uppercase mb-2">
                      <Layers size={16} /> Personal Space
                  </div>
                  <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:via-gray-200 dark:to-gray-500 tracking-tight mb-4">
                      My Collections
                  </h1>
                  <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl">
                      Organize assets into custom folders for your projects.
                  </p>
              </div>
              <button onClick={openCreate} className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-bold shadow-lg hover:scale-105 transition-transform">
                  <Plus size={20} /> New Collection
              </button>
          </div>
      </motion.div>

      {/* GRID */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 py-12">
        {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => <CollectionSkeleton key={i} />)}
            </div>
        ) : collections.length === 0 ? (
            <div className="text-center py-20 opacity-50 bg-white/50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-300 dark:border-white/10 backdrop-blur-sm">
                <Folder size={64} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">No collections yet. Create one!</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <AnimatePresence>
                    {collections.map((col) => (
                        <CollectionCard 
                            key={col.id} 
                            col={col} 
                            onEdit={openEdit} 
                            onDelete={(id) => setDeleteId(id)} 
                        />
                    ))}
                </AnimatePresence>
            </div>
        )}
      </div>

      {/* MODAL */}
      <AnimatePresence>
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-white/10">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Collection' : 'New Collection'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white"><X size={20}/></button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Name</label>
                            <input autoFocus type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" placeholder="e.g. Marketing Assets" />
                        </div>
                        <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-2 w-full mt-2 rounded-xl bg-indigo-600 text-white font-bold py-3 hover:bg-indigo-700 transition-colors disabled:opacity-70">
                            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                            {isSubmitting ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                        </button>
                    </form>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={handleDelete} 
        title="Delete Collection" 
        message="This will delete the collection AND all sub-folders. Assets will be unlinked, not deleted." 
        confirmText="Delete Everything" 
        isDangerous={true} 
        isLoading={deleteMutation.isPending} // ✅ This spinner will now be visible
      />
    </div>
  );
};

export default Collections;