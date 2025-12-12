import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { 
    Folder, 
    Loader2, 
    Plus, 
    X, 
    Trash2, 
    // Image as ImageIcon, <--- DELETE
    MoreVertical,
    Edit2,
    Layers, 
    Clock,
    // UploadCloud <--- DELETE
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal';
import { motion } from 'framer-motion';

// ✅ Interface matched to your Controller Response
interface Collection {
  id: string;
  name: string;
  createdAt: string;
  _count: { assets: number };
  coverImage: string | null; // Controller returns this now
}

const Collections = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formName, setFormName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCollections = async () => {
    try {
      const { data } = await client.get('/collections');
      setCollections(data);
    } catch (error) { toast.error("Failed to load collections"); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCollections(); }, []);

  // --- ACTIONS ---

  const openCreate = () => {
      setEditingId(null);
      setFormName('');
      setIsModalOpen(true);
  };

  const openEdit = (e: React.MouseEvent, col: Collection) => {
      e.preventDefault();
      setEditingId(col.id);
      setFormName(col.name);
      setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    
    setIsSubmitting(true);
    try {
        if (editingId) {
            // Note: Ensure you have an 'updateCollection' controller for this to work
            await client.patch(`/collections/${editingId}`, { name: formName });
            toast.success("Collection updated!");
        } else {
            await client.post('/collections', { name: formName });
            toast.success("Collection created!");
        }
        setIsModalOpen(false);
        fetchCollections();
    } catch (error: any) {
        toast.error(error.response?.data?.message || 'Operation failed');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
        // Note: Ensure you have a 'deleteCollection' controller for this to work
        await client.delete(`/collections/${deleteId}`);
        toast.success("Collection deleted");
        setCollections(prev => prev.filter(c => c.id !== deleteId));
        setDeleteId(null);
    } catch (error) { toast.error("Failed to delete collection"); } 
    finally { setIsDeleting(false); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center dark:bg-[#0B0D0F]"><Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={32} /></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] transition-colors duration-500">
      
      {/* HEADER */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#121417] border-b border-gray-200 dark:border-white/5 pt-12 pb-16 px-8"
      >
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-6">
              <div>
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm tracking-wider uppercase mb-2">
                      <Layers size={16} /> Personal Space
                  </div>
                  <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
                      My Collections
                  </h1>
                  <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl">
                      Organize assets into custom folders for your projects.
                  </p>
              </div>
              
              <button 
                onClick={openCreate} 
                className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-bold shadow-lg hover:scale-105 transition-transform"
              >
                  <Plus size={20} /> New Collection
              </button>
          </div>
      </motion.div>

      {/* GRID */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        {collections.length === 0 ? (
            <div className="text-center py-20 opacity-50">
                <Folder size={64} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">No collections yet. Create one!</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {collections.map((col, index) => (
                    <motion.div 
                        key={col.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group relative flex flex-col rounded-3xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden h-64"
                    >
                        <Link to={`/collections/${col.id}`} className="flex-1 flex flex-col">
                            
                            {/* COVER AREA (With Glitch Fix) */}
                            <div 
                                className="relative flex-1 w-full overflow-hidden bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-indigo-900/20 dark:to-blue-900/10 flex items-center justify-center isolation-isolate"
                                style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
                            >
                                {col.coverImage ? (
                                    <>
                                        <img 
                                            src={col.coverImage} 
                                            alt={col.name} 
                                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 transform-gpu will-change-transform" 
                                        />
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                                    </>
                                ) : (
                                    <div className="p-4 rounded-2xl bg-white/40 dark:bg-white/5 backdrop-blur-sm shadow-inner relative z-10">
                                        <Folder size={40} className="text-indigo-500 dark:text-indigo-400 drop-shadow-sm" />
                                    </div>
                                )}
                                
                                {/* Count Badge */}
                                <div className="absolute top-4 right-4 rounded-full bg-white/90 dark:bg-black/60 px-3 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-md border border-transparent dark:border-white/10 z-10">
                                    {col._count.assets}
                                </div>
                            </div>

                            {/* FOOTER */}
                            <div className="flex items-center justify-between p-5 bg-white dark:bg-[#1A1D21] border-t border-gray-50 dark:border-white/5 relative z-10">
                                <div className="min-w-0">
                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {col.name}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        <Clock size={12} /> {new Date(col.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="h-8 w-8 shrink-0 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-indigo-900/20 dark:group-hover:text-indigo-400 transition-colors">
                                    <MoreVertical size={16} />
                                </div>
                            </div>
                        </Link>

                        {/* ACTIONS */}
                        <div className="absolute top-3 left-3 flex gap-2 opacity-0 transform scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 z-20">
                            <button 
                                onClick={(e) => openEdit(e, col)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-black/80 text-gray-600 dark:text-gray-300 shadow-md backdrop-blur-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 transition-colors"
                                title="Edit Collection"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button 
                                onClick={(e) => { e.preventDefault(); setDeleteId(col.id); }}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-black/80 text-gray-400 dark:text-gray-400 shadow-md backdrop-blur-sm hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors"
                                title="Delete Collection"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-white/10">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Collection' : 'New Collection'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Name</label>
                        <input autoFocus type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" placeholder="e.g. Marketing Assets" />
                    </div>
                    
                    <button type="submit" disabled={isSubmitting} className="w-full mt-2 rounded-xl bg-indigo-600 text-white font-bold py-3 hover:bg-indigo-700 transition-colors disabled:opacity-70">
                        {isSubmitting ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                    </button>
                </form>
            </motion.div>
        </div>
      )}

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Collection" message="Assets inside will not be deleted." confirmText="Delete" isDangerous={true} isLoading={isDeleting} />
    </div>
  );
};

export default Collections;