import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { 
    Folder, 
    Loader2, 
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
import { motion } from 'framer-motion'; // ✅ Import Framer Motion

interface Category {
  id: string;
  name: string;
  group: string;
  coverImage?: string;
  _count: { assets: number };
}

const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formName, setFormName] = useState('');
  const [formGroup, setFormGroup] = useState('Inspiration');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formPreview, setFormPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'editor';

  const fetchCategories = async () => {
    try {
      const { data } = await client.get('/categories');
      setCategories(data);
    } catch (error) { toast.error("Failed to load topics"); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCategories(); }, []);

  // --- HANDLERS ---
  const openCreate = () => {
      setEditingId(null);
      setFormName('');
      setFormGroup('Features');
      setFormFile(null);
      setFormPreview(null);
      setIsModalOpen(true);
  };

  const openEdit = (e: React.MouseEvent, cat: Category) => {
      e.preventDefault();
      setEditingId(cat.id);
      setFormName(cat.name);
      setFormGroup(cat.group);
      setFormFile(null);
      setFormPreview(cat.coverImage || null);
      setIsModalOpen(true);
  };

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
    try {
        const formData = new FormData();
        formData.append('name', formName);
        formData.append('group', formGroup);
        if (formFile) formData.append('cover', formFile);

        if (editingId) {
            await client.patch(`/categories/${editingId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success("Topic updated!");
        } else {
            await client.post('/categories', formData, {
                 headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success("Topic created!");
        }
        
        setIsModalOpen(false);
        fetchCategories();
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
        await client.delete(`/categories/${deleteId}`);
        toast.success("Topic deleted");
        setCategories(prev => prev.filter(c => c.id !== deleteId));
        setDeleteId(null);
    } catch (error) { toast.error("Failed to delete topic"); } 
    finally { setIsDeleting(false); }
  };

  const features = categories.filter(c => c.group === 'Features');
  const inspiration = categories.filter(c => c.group === 'Inspiration');

  // --- CARD COMPONENT (With Glitch Fix) ---
  const CategoryCard = ({ cat, icon: Icon, colorClass }: { cat: Category, icon: any, colorClass: string }) => (
    <div className="group relative flex flex-col rounded-3xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] shadow-sm hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden h-64">
        <Link to={`/categories/${cat.id}`} className="flex-1 flex flex-col">
            {/* Cover Area - Optimized to prevent glitching */}
            <div 
                className={`relative flex-1 w-full overflow-hidden ${colorClass} flex items-center justify-center isolation-isolate`}
                style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
            >
                {cat.coverImage ? (
                    <>
                        <img src={cat.coverImage} alt={cat.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 transform-gpu will-change-transform" />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                    </>
                ) : (
                    <div className="p-4 rounded-2xl bg-white/20 dark:bg-black/10 backdrop-blur-sm shadow-inner relative z-10">
                        <Icon size={40} className="text-white drop-shadow-sm" />
                    </div>
                )}
                
                <div className="absolute top-4 right-4 rounded-full bg-white/90 dark:bg-black/60 px-3 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-md border border-transparent dark:border-white/10 z-10">
                    {cat._count.assets}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-5 bg-white dark:bg-[#1A1D21] border-t border-gray-50 dark:border-white/5 relative z-10">
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-[180px]">
                        {cat.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        <ImageIcon size={12} /> {cat._count.assets} assets
                    </div>
                </div>
                
                <div className="h-8 w-8 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 dark:group-hover:bg-blue-900/20 dark:group-hover:text-blue-400 transition-colors">
                    <MoreVertical size={16} />
                </div>
            </div>
        </Link>

        {/* ACTIONS */}
        {canManage && (
            <>
                <button onClick={(e) => openEdit(e, cat)} className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-black/80 text-gray-600 dark:text-gray-300 shadow-md backdrop-blur-sm opacity-0 transform scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 z-20" title="Edit Topic"><Edit2 size={14} /></button>
                <button onClick={(e) => { e.preventDefault(); setDeleteId(cat.id); }} className="absolute top-3 left-12 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-black/80 text-gray-400 dark:text-gray-400 shadow-md backdrop-blur-sm opacity-0 transform scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 z-20 delay-75" title="Delete Topic"><Trash2 size={14} /></button>
            </>
        )}
    </div>
  );

  if (loading) return <div className="flex h-screen items-center justify-center dark:bg-[#0B0D0F]"><Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={32} /></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] transition-colors duration-500 overflow-x-hidden">
      
      {/* --- HERO SECTION --- */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="bg-white dark:bg-[#121417] border-b border-gray-200 dark:border-white/5 pt-12 pb-16 px-8"
      >
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
      </motion.div>

      {/* --- CONTENT AREA --- */}
      <div className="max-w-7xl mx-auto px-8 py-12 space-y-16">
        
        {/* SECTION 1: FEATURES */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
        >
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <Layout size={24} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Feature Modules</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {features.map(c => (
                    <CategoryCard key={c.id} cat={c} icon={Folder} colorClass="bg-gradient-to-br from-cyan-500 to-blue-600" />
                ))}
            </div>
        </motion.div>

        {/* SECTION 2: INSPIRATION */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
        >
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                    <Lightbulb size={24} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Design Inspiration</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {inspiration.map(c => (
                    <CategoryCard key={c.id} cat={c} icon={Lightbulb} colorClass="bg-gradient-to-br from-purple-500 to-pink-600" />
                ))}
            </div>
        </motion.div>

      </div>

      {/* --- CREATE/EDIT MODAL --- */}
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
                    {/* Name */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Topic Name</label>
                        <input autoFocus type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30" placeholder="e.g. 3D Icons" />
                    </div>

                    {/* Group */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Group</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['Features', 'Inspiration'].map(g => (
                                <button key={g} type="button" onClick={() => setFormGroup(g)} className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${formGroup === g ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/10'}`}>{g}</button>
                            ))}
                        </div>
                    </div>

                    {/* Cover Image */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Cover Image (Optional)</label>
                        <div className="relative group cursor-pointer border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-black/20 hover:border-blue-400 transition-colors h-32 flex flex-col items-center justify-center text-center overflow-hidden">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                            {formPreview ? (
                                <img src={formPreview} alt="Preview" className="w-full h-full object-cover" />
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

      {/* --- DELETE CONFIRM --- */}
      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Topic" message="Are you sure? This will delete the folder but keep the assets." confirmText="Delete" isDangerous={true} isLoading={isDeleting} />
    </div>
  );
};

export default Categories;