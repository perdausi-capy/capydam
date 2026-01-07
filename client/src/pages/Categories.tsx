import React, { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { 
    Folder,  
    Layout, 
    Lightbulb, 
    Plus, 
    X, 
    Trash2, 
    Image as ImageIcon,
    MoreVertical,
    Edit2,
    Sparkles,
    UploadCloud
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Category {
  id: string;
  name: string;
  group: string;
  coverImage?: string;
  _count: { assets: number };
}

// ⚡️ HELPER: Resize images on the fly to save bandwidth
const getOptimizedUrl = (url: string | undefined) => {
    if (!url) return undefined;
    // If using Supabase, append transformation params
    if (url.includes('supabase.co')) return `${url}?width=600&resize=cover&quality=70`;
    return url;
};

// --- 🦴 SKELETON COMPONENT ---
const CategorySkeleton = React.memo(() => (
    <div className="rounded-3xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] h-64 overflow-hidden">
        <div className="h-4/5 bg-gray-200 dark:bg-white/5 animate-pulse" />
        <div className="h-1/5 p-5 flex items-center justify-between border-t border-gray-100 dark:border-white/5">
            <div className="h-4 w-32 bg-gray-200 dark:bg-white/5 rounded animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-white/5 animate-pulse" />
        </div>
    </div>
));

// --- 🎥 SMART MEDIA COMPONENT ---
const CardMedia = React.memo(({ src, alt, className }: { src: string, alt: string, className: string }) => {
    const isVideo = useMemo(() => src.match(/\.(mp4|webm|mov)$/i), [src]);
    const optimizedSrc = useMemo(() => isVideo ? src : getOptimizedUrl(src), [src, isVideo]);

    if (isVideo) {
        return (
            <video
                src={src} // Videos usually shouldn't be resized via URL params unless supported
                className={className}
                muted loop playsInline autoPlay
                style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
            />
        );
    }

    return (
        <img 
            src={optimizedSrc} 
            alt={alt} 
            className={className}
            loading="lazy"
            decoding="async"
        />
    );
});

// --- 💎 MEMOIZED CARD COMPONENT ---
const CategoryCard = React.memo(({ cat, icon: Icon, colorClass, canManage, onEdit, onDelete }: any) => (
    <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="group relative flex flex-col rounded-3xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden h-64 transform-gpu"
    >
        <Link to={`/categories/${cat.id}`} className="flex-1 flex flex-col h-full z-0">
            {/* COVER AREA */}
            <div className={`relative flex-1 w-full overflow-hidden ${colorClass} flex items-center justify-center`}>
                {cat.coverImage ? (
                    <>
                        <CardMedia 
                            src={cat.coverImage} 
                            alt={cat.name} 
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-300" />
                    </>
                ) : (
                    <div className="p-4 rounded-2xl bg-white/20 dark:bg-black/10 backdrop-blur-sm shadow-inner relative z-10">
                        <Icon size={40} className="text-white drop-shadow-sm" />
                    </div>
                )}
                
                {/* Count Badge */}
                <div className="absolute top-4 right-4 rounded-full bg-white/90 dark:bg-black/60 px-3 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-md border border-transparent dark:border-white/10 z-10">
                    {cat._count.assets}
                </div>
            </div>

            {/* FOOTER */}
            <div className="relative z-10 flex items-center justify-between p-5 bg-white dark:bg-[#1A1D21] border-t border-gray-50 dark:border-white/5">
                <div className="min-w-0 pr-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                        {cat.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        <ImageIcon size={12} /> {cat._count.assets} assets
                    </div>
                </div>
                <div className="h-8 w-8 shrink-0 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-indigo-900/20 dark:group-hover:text-indigo-400 transition-colors">
                    <MoreVertical size={16} />
                </div>
            </div>
        </Link>

        {/* ACTIONS */}
        {canManage && (
            <div className="absolute top-3 left-3 flex gap-2 opacity-0 transform scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 z-20">
                <button onClick={(e) => onEdit(e, cat)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-black/80 text-gray-600 dark:text-gray-300 shadow-md backdrop-blur-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 transition-colors" title="Edit">
                    <Edit2 size={14} />
                </button>
                <button onClick={(e) => { e.preventDefault(); onDelete(cat.id); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-black/80 text-gray-400 dark:text-gray-400 shadow-md backdrop-blur-sm hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors" title="Delete">
                    <Trash2 size={14} />
                </button>
            </div>
        )}
    </motion.div>
));

const Categories = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'admin' || user?.role === 'editor';

  // --- 1. DATA FETCHING (Cached) ---
  const { data: categories = [], isLoading: loading } = useQuery<Category[]>({
      queryKey: ['categories'],
      queryFn: async () => {
          const { data } = await client.get('/categories');
          return data;
      },
      staleTime: 1000 * 60 * 10, // ✅ Data stays fresh for 10 minutes (Instant load on return)
      refetchOnWindowFocus: false,
  });
  
  // Modals & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formGroup, setFormGroup] = useState('Inspiration');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formPreview, setFormPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // --- 2. OPTIMIZED MUTATIONS ---
  const createMutation = useMutation({
      mutationFn: (formData: FormData) => client.post('/categories', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
      onSuccess: () => {
          queryClient.invalidateQueries(['categories'] as any);
          toast.success("Topic created!");
          setIsModalOpen(false);
      },
      onError: (err: any) => toast.error(err.response?.data?.message || 'Failed')
  });

  const updateMutation = useMutation({
      mutationFn: ({ id, data }: { id: string, data: FormData }) => client.patch(`/categories/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
      onSuccess: () => {
          queryClient.invalidateQueries(['categories'] as any);
          toast.success("Topic updated!");
          setIsModalOpen(false);
      }
  });

  const deleteMutation = useMutation({
      mutationFn: (id: string) => client.delete(`/categories/${id}`),
      onSuccess: () => {
          queryClient.invalidateQueries(['categories'] as any);
          toast.success("Topic deleted");
          setDeleteId(null);
      }
  });

  // --- HANDLERS (Memoized) ---
  const openCreate = useCallback(() => {
      setEditingId(null); setFormName(''); setFormGroup('Features'); setFormFile(null); setFormPreview(null); setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((e: React.MouseEvent, cat: Category) => {
      e.preventDefault(); 
      setEditingId(cat.id); 
      setFormName(cat.name); 
      setFormGroup(cat.group); 
      setFormFile(null); 
      setFormPreview(cat.coverImage || null); 
      setIsModalOpen(true);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setFormFile(file);
          setFormPreview(URL.createObjectURL(file));
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setIsSubmitting(true);
    
    const formData = new FormData();
    formData.append('name', formName);
    formData.append('group', formGroup);
    if (formFile) formData.append('cover', formFile);

    try {
        if (editingId) {
            await updateMutation.mutateAsync({ id: editingId, data: formData });
        } else {
            await createMutation.mutateAsync(formData);
        }
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (deleteId) deleteMutation.mutate(deleteId);
  };

  // Memoize Filtered Lists to prevent recalc on every render
  const features = useMemo(() => categories.filter(c => c.group === 'Features'), [categories]);
  const inspiration = useMemo(() => categories.filter(c => c.group === 'Inspiration'), [categories]);

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] transition-colors duration-500 overflow-x-hidden">
      
      {/* HERO SECTION */}
      <div className="bg-white dark:bg-[#121417] border-b border-gray-200 dark:border-white/5 pt-12 pb-16 px-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-6">
              <div>
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm tracking-wider uppercase mb-2">
                      <Sparkles size={16} /> Capytech Design System
                  </div>
                  <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
                      Explore Topics
                  </h1>
                  <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl">
                      Curated collections of features, patterns, and inspiration for your next Storyline project.
                  </p>
              </div>
              
              {canManage && (
                <button onClick={openCreate} className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-bold shadow-lg hover:scale-105 transition-transform">
                    <Plus size={20} /> New Topic
                </button>
              )}
          </div>
      </div>

      {/* CONTENT AREA */}
      <div className="max-w-7xl mx-auto px-8 py-12 space-y-16">
        
        {/* SECTION 1: FEATURES */}
        <div>
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <Layout size={24} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Feature Modules</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <CategorySkeleton key={i} />)
                ) : (
                    features.map(c => (
                        <CategoryCard 
                            key={c.id} 
                            cat={c} 
                            icon={Folder} 
                            colorClass="bg-gradient-to-br from-cyan-500 to-blue-600" 
                            canManage={canManage}
                            onEdit={openEdit}
                            onDelete={(id: string) => setDeleteId(id)}
                        />
                    ))
                )}
            </div>
        </div>

        {/* SECTION 2: INSPIRATION */}
        <div>
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                    <Lightbulb size={24} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Design Inspiration</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <CategorySkeleton key={i} />)
                ) : (
                    inspiration.map(c => (
                        <CategoryCard 
                            key={c.id} 
                            cat={c} 
                            icon={Lightbulb} 
                            colorClass="bg-gradient-to-br from-purple-500 to-pink-600"
                            canManage={canManage}
                            onEdit={openEdit}
                            onDelete={(id: string) => setDeleteId(id)}
                        />
                    ))
                )}
            </div>
        </div>

      </div>

      {/* --- CREATE/EDIT MODAL --- */}
      <AnimatePresence>
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative w-full max-w-md bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-white/10"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Topic' : 'Add New Topic'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20}/></button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Topic Name</label>
                            <input autoFocus type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30" placeholder="e.g. 3D Icons" />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Group</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['Features', 'Inspiration'].map(g => (
                                    <button key={g} type="button" onClick={() => setFormGroup(g)} className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${formGroup === g ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/10'}`}>{g}</button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Cover Image (Optional)</label>
                            <div className="relative group cursor-pointer border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-black/20 hover:border-blue-400 transition-colors h-32 flex flex-col items-center justify-center text-center overflow-hidden">
                                <input type="file" accept="image/*,video/mp4" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                                {formPreview ? (
                                    formPreview.match(/\.(mp4|webm)$/i) || (formFile && formFile.type.startsWith('video/')) ? (
                                        <video src={formPreview} className="w-full h-full object-cover" muted autoPlay loop />
                                    ) : (
                                        <img src={formPreview} alt="Preview" className="w-full h-full object-cover" />
                                    )
                                ) : (
                                    <div className="text-gray-400 dark:text-gray-500">
                                        <UploadCloud size={24} className="mx-auto mb-2" />
                                        <span className="text-xs">Click to upload cover</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button type="submit" disabled={isSubmitting} className="w-full mt-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-3 hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-70">
                            {isSubmitting ? 'Saving...' : (editingId ? 'Update Topic' : 'Create Topic')}
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
        title="Delete Topic" 
        message="Are you sure? This will delete the folder but keep the assets." 
        confirmText="Delete" 
        isDangerous={true} 
        isLoading={deleteMutation.isPending} 
      />
    </div>
  );
};

export default Categories;