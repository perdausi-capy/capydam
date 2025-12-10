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
    Edit2, // <--- New Icon
    UploadCloud
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal';

interface Category {
  id: string;
  name: string;
  group: string;
  coverImage?: string; // <--- New Field
  _count: { assets: number };
}

const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
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
    } catch (error) { toast.error("Failed to load categories"); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCategories(); }, []);

  // Open Edit Modal
  const openEdit = (e: React.MouseEvent, cat: Category) => {
      e.preventDefault();
      setEditingId(cat.id);
      setFormName(cat.name);
      setFormGroup(cat.group);
      setFormFile(null);
      setFormPreview(cat.coverImage || null);
      setIsEditOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setFormFile(file);
          setFormPreview(URL.createObjectURL(file));
      }
  };

  // Submit Create or Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    
    setIsSubmitting(true);
    try {
        const formData = new FormData();
        formData.append('name', formName);
        formData.append('group', formGroup);
        if (formFile) formData.append('cover', formFile); // Attach file

        if (editingId) {
            // UPDATE
            await client.patch(`/categories/${editingId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success("Topic updated!");
        } else {
            // CREATE (Note: simplified to JSON if no file, but let's use same endpoint style if needed)
            // For create, we used JSON before. Let's keep it simple or upgrade create to support file too.
            // For now, assume Create is text-only, Edit adds images.
            await client.post('/categories', { name: formName, group: formGroup });
            toast.success("Topic created!");
        }
        
        closeModals();
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
    } catch (error) { toast.error("Failed to delete"); } 
    finally { setIsDeleting(false); }
  };

  const closeModals = () => {
      setIsCreateOpen(false);
      setIsEditOpen(false);
      setEditingId(null);
      setFormName('');
      setFormFile(null);
      setFormPreview(null);
  };

  const features = categories.filter(c => c.group === 'Features');
  const inspiration = categories.filter(c => c.group === 'Inspiration');

  // --- CARD COMPONENT ---
  const CategoryCard = ({ cat, icon: Icon, colorClass }: { cat: Category, icon: any, colorClass: string }) => (
    <div className="group relative flex flex-col rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#1A1D21] shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-900 overflow-hidden h-60">
        
        <Link to={`/categories/${cat.id}`} className="flex-1 flex flex-col">
            {/* Cover Area */}
            <div className={`relative flex-1 w-full overflow-hidden ${colorClass} flex items-center justify-center`}>
                
                {/* 1. Show Custom Cover if exists */}
                {cat.coverImage ? (
                    <>
                        <img src={cat.coverImage} alt={cat.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                    </>
                ) : (
                    /* 2. Fallback Icon */
                    <div className="p-4 rounded-2xl bg-white/20 dark:bg-black/10 backdrop-blur-sm shadow-inner relative z-10">
                        <Icon size={40} className="text-white dark:text-white/90 drop-shadow-sm" />
                    </div>
                )}
                
                {/* Count Badge */}
                <div className="absolute top-3 right-3 rounded-full bg-white/90 dark:bg-black/60 px-2.5 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-sm border border-transparent dark:border-white/10 z-10">
                    {cat._count.assets}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-50 dark:border-white/5 bg-white dark:bg-[#1A1D21] relative z-10">
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-[150px]">
                        {cat.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        <ImageIcon size={12} /> {cat._count.assets} assets
                    </div>
                </div>
            </div>
        </Link>

        {/* ACTIONS (Hover Only) */}
        {canManage && (
            <>
                <button
                    onClick={(e) => openEdit(e, cat)}
                    className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-black/80 text-gray-600 dark:text-gray-300 shadow-md backdrop-blur-sm opacity-0 transform scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 z-20"
                    title="Edit Topic"
                >
                    <Edit2 size={14} />
                </button>
                <button
                    onClick={(e) => { e.preventDefault(); setDeleteId(cat.id); }}
                    className="absolute top-3 left-12 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-black/80 text-gray-400 dark:text-gray-400 shadow-md backdrop-blur-sm opacity-0 transform scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 z-20 delay-75"
                    title="Delete Topic"
                >
                    <Trash2 size={14} />
                </button>
            </>
        )}
    </div>
  );

  if (loading) return <div className="flex h-screen items-center justify-center dark:bg-[#0B0D0F]"><Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={32} /></div>;

  return (
    <div className="min-h-screen p-8 bg-[#F8F9FC] dark:bg-[#0B0D0F] transition-colors duration-500">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Explore Topics</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Curated folders for quick access.</p>
            </div>
            
            {canManage && (
                <button 
                    onClick={() => {
                        setEditingId(null);
                        setFormName('');
                        setFormFile(null);
                        setFormPreview(null);
                        setIsCreateOpen(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
                >
                    <Plus size={20} /> Add Topic
                </button>
            )}
        </div>

        {/* SECTIONS */}
        <div className="mb-12">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-700 dark:text-gray-300 mb-6 uppercase tracking-wider">
                <Layout size={20} className="text-blue-500" /> Feature Modules
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {features.map(c => <CategoryCard key={c.id} cat={c} icon={Folder} colorClass="bg-gradient-to-br from-blue-400 to-indigo-500 dark:from-blue-600/40 dark:to-indigo-600/40" />)}
            </div>
        </div>

        <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-700 dark:text-gray-300 mb-6 uppercase tracking-wider">
                <Lightbulb size={20} className="text-purple-500" /> Design Inspiration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {inspiration.map(c => <CategoryCard key={c.id} cat={c} icon={Lightbulb} colorClass="bg-gradient-to-br from-purple-400 to-pink-500 dark:from-purple-600/40 dark:to-pink-600/40" />)}
            </div>
        </div>

        {/* --- EDIT/CREATE MODAL --- */}
        {(isCreateOpen || isEditOpen) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModals} />
                <div className="relative w-full max-w-md bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Topic' : 'Add New Topic'}</h3>
                        <button onClick={closeModals} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20}/></button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name Input */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Topic Name</label>
                            <input 
                                autoFocus
                                type="text"
                                required
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                                placeholder="e.g. 3D Icons"
                            />
                        </div>

                        {/* Group Selector */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Group</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setFormGroup('Features')} className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${formGroup === 'Features' ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/10'}`}>Features</button>
                                <button type="button" onClick={() => setFormGroup('Inspiration')} className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${formGroup === 'Inspiration' ? 'bg-purple-50 border-purple-200 text-purple-600 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/10'}`}>Inspiration</button>
                            </div>
                        </div>

                        {/* Cover Image Upload */}
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

                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full mt-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-3 hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-70"
                        >
                            {isSubmitting ? 'Saving...' : (editingId ? 'Update Topic' : 'Create Topic')}
                        </button>
                    </form>
                </div>
            </div>
        )}

        <ConfirmModal 
            isOpen={!!deleteId}
            onClose={() => setDeleteId(null)}
            onConfirm={handleDelete}
            title="Delete Topic"
            message="Are you sure? This will delete the folder but keep the assets."
            confirmText="Delete"
            isDangerous={true}
            isLoading={isDeleting}
        />

      </div>
    </div>
  );
};

export default Categories;