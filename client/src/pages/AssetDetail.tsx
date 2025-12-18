import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { 
    ArrowLeft, Download, Trash2, 
    Calendar, HardDrive, FileText, 
    FolderPlus, Hash, ExternalLink, Check, 
    Layout, Link as LinkIcon, Plus, X,
    Edit2, Search, Loader2, Share2 // ✅ Added Share2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal';
import Masonry from 'react-masonry-css';
import AssetThumbnail from '../components/AssetThumbnail';
import { useQueryClient } from '@tanstack/react-query';

// --- TYPES ---
interface Asset {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  thumbnailPath: string | null;
  createdAt: string;
  userId: string;
  uploadedBy: { name: string };
  aiData: string;
}

interface CollectionSimple { id: string; name: string; }
interface CategorySimple { id: string; name: string; }

// --- COMPONENT: Collapsible Text ---
const CollapsibleText = ({ text }: { text: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const limit = 200;

    if (!text) return null;
    if (text.length <= limit) return <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm break-words">{text}</p>;

    return (
        <div>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm break-words">
                {isExpanded ? text : `${text.substring(0, limit)}...`}
            </p>
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-wide flex items-center gap-1"
            >
                {isExpanded ? 'Show Less' : 'Read More'}
            </button>
        </div>
    );
};

// --- MAIN PAGE SKELETON ---
const DetailSkeleton = () => (
    <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 animate-pulse">
        <div className="lg:col-span-2 space-y-8">
            <div className="w-full aspect-video bg-gray-200 dark:bg-white/5 rounded-3xl" />
            <div className="h-8 w-48 bg-gray-200 dark:bg-white/5 rounded-lg" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="h-40 bg-gray-200 dark:bg-white/5 rounded-xl" />
                <div className="h-56 bg-gray-200 dark:bg-white/5 rounded-xl" />
                <div className="h-32 bg-gray-200 dark:bg-white/5 rounded-xl" />
                <div className="h-48 bg-gray-200 dark:bg-white/5 rounded-xl" />
            </div>
        </div>
        <div className="space-y-6">
            <div className="h-10 w-3/4 bg-gray-200 dark:bg-white/5 rounded-lg" />
            <div className="flex gap-2">
                <div className="h-4 w-20 bg-gray-200 dark:bg-white/5 rounded-lg" />
                <div className="h-4 w-20 bg-gray-200 dark:bg-white/5 rounded-lg" />
            </div>
            <div className="h-px bg-gray-200 dark:bg-white/5 my-6" />
            <div className="grid grid-cols-2 gap-3">
                <div className="h-12 w-full bg-gray-200 dark:bg-white/5 rounded-xl" />
                <div className="h-12 w-full bg-gray-200 dark:bg-white/5 rounded-xl" />
            </div>
            <div className="h-24 w-full bg-gray-200 dark:bg-white/5 rounded-2xl" />
        </div>
    </div>
);

// --- RELATED ITEMS SKELETON ---
const RelatedSkeleton = () => (
    <div className="mt-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">More Like This</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                    <div 
                        className="w-full bg-gray-200 dark:bg-white/5 rounded-xl animate-pulse" 
                        style={{ height: i % 2 === 0 ? '200px' : '280px' }} 
                    />
                </div>
            ))}
        </div>
    </div>
);

const AssetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [relatedAssets, setRelatedAssets] = useState<Asset[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isRelatedLoading, setIsRelatedLoading] = useState(true);
  
  const [collections, setCollections] = useState<CollectionSimple[]>([]);
  const [categories, setCategories] = useState<CategorySimple[]>([]); 

  const [activeModal, setActiveModal] = useState<'collection' | 'topic' | null>(null);
  const [modalSearch, setModalSearch] = useState(''); 
  const [addingToId, setAddingToId] = useState<string | null>(null);

  const [isEditingLink, setIsEditingLink] = useState(false);
  const [driveLink, setDriveLink] = useState('');
  const [isSavingLink, setIsSavingLink] = useState(false);

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [parsedAi, setParsedAi] = useState<any>({});
  const queryClient = useQueryClient();

  // ✅ Permissions
  const canManageAsset = user?.role === 'admin' || user?.role === 'editor' || user?.id === asset?.userId;
  const canAddToTopic = user?.role === 'admin' || user?.role === 'editor';

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        setIsRelatedLoading(true); 
        setRelatedAssets([]); 

        try {
            const assetRes = await client.get(`/assets/${id}`);
            setAsset(assetRes.data);
            setNewName(assetRes.data.originalName || assetRes.data.filename);
            
            try {
                const ai = JSON.parse(assetRes.data.aiData || '{}');
                setParsedAi(ai);
                setDriveLink(ai.externalLink || ai.link || ai.url || '');
            } catch { setParsedAi({}); }

            setLoading(false); 

            client.get('/collections').then(res => setCollections(res.data || [])).catch(() => {});
            client.get('/categories').then(res => setCategories(res.data || [])).catch(() => {});

            try {
                const relatedRes = await client.get(`/assets/${id}/related`);
                setRelatedAssets(relatedRes.data || []);
            } catch (err) {
                console.error("Failed to load related assets");
            } finally {
                setIsRelatedLoading(false);
            }

        } catch (error) {
            toast.error("Asset not found");
            navigate('/');
        }
    };
    if (id) loadData();
  }, [id, navigate]);

  const handleDownload = async () => {
    if (!asset) return;
    try {
      toast.info('Downloading...');
      const response = await fetch(asset.path);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = asset.originalName;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (e) { toast.error("Download failed"); }
  };

  // ✅ New Share Handler
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
  };

  const handleDelete = async () => {
    if (!asset) return;
    setIsDeleting(true);
    try {
      await client.delete(`/assets/${asset.id}`);
      await queryClient.resetQueries({ queryKey: ['assets'] });
      toast.success("Asset deleted");
      navigate(-1);
    } catch (error) {
      toast.error("Failed to delete asset");
      setIsDeleting(false);
    }
  };

  const handleRename = async () => {
      if (!asset || !newName.trim()) return;
      try {
          await client.patch(`/assets/${asset.id}`, { originalName: newName });
          setAsset({ ...asset, originalName: newName });
          setIsRenaming(false);
          toast.success("Renamed successfully");
      } catch (error) {
          toast.error("Failed to rename");
      }
  };

  const saveDriveLink = async () => {
      if (!asset) return;
      setIsSavingLink(true);
      try {
          const newAiData = { ...parsedAi, externalLink: driveLink };
          await client.patch(`/assets/${asset.id}`, { aiData: JSON.stringify(newAiData) });
          setParsedAi(newAiData);
          setIsEditingLink(false);
          toast.success("Link saved!");
      } catch (error) { toast.error("Failed to save link"); } 
      finally { setIsSavingLink(false); }
  };

  const handleAddTag = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!asset || !newTag.trim()) return;
      const currentTags = parsedAi.tags || parsedAi.keywords || [];
      if (currentTags.includes(newTag.trim())) { setNewTag(''); return; }
      const updatedTags = [...currentTags, newTag.trim()];
      await updateTags(updatedTags);
      setNewTag('');
      setIsAddingTag(false);
  };

  const handleRemoveTag = async (tagToRemove: string) => {
      if (!asset) return;
      const currentTags = parsedAi.tags || parsedAi.keywords || [];
      const updatedTags = currentTags.filter((t: string) => t !== tagToRemove);
      await updateTags(updatedTags);
  };

  const updateTags = async (newTags: string[]) => {
      if (!asset) return;
      const newAiData = { ...parsedAi, tags: newTags };
      try {
          await client.patch(`/assets/${asset.id}`, { aiData: JSON.stringify(newAiData) });
          setParsedAi(newAiData);
      } catch (error) { toast.error("Failed to update tags"); }
  };

  const openSelectionModal = (type: 'collection' | 'topic') => {
      setModalSearch(''); 
      setActiveModal(type);
      setAddingToId(null); 
  };

  const addToCollection = async (collectionId: string, name: string) => {
      if (!asset || addingToId) return; 
      setAddingToId(collectionId); 
      
      try {
          await client.post(`/collections/${collectionId}/assets`, { assetId: asset.id });
          toast.success(`Added to ${name}`);
          setActiveModal(null); 
      } catch (e) { 
          toast.info("Already in this collection"); 
      } finally {
          setAddingToId(null);
      }
  };

  const addToTopic = async (categoryId: string, name: string) => {
      if (!asset || addingToId) return;
      setAddingToId(categoryId);

      try {
          await client.post(`/categories/${categoryId}/assets`, { assetId: asset.id });
          toast.success(`Added to ${name}`);
          setActiveModal(null);
      } catch (e) { 
          toast.info("Already in this topic"); 
      } finally {
          setAddingToId(null);
      }
  };

  const filteredCollections = collections.filter(c => c.name.toLowerCase().includes(modalSearch.toLowerCase()));
  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(modalSearch.toLowerCase()));

  const breakpointColumnsObj = { default: 4, 1100: 3, 700: 2, 500: 1 };

  const effectiveLink = parsedAi.externalLink || parsedAi.link || parsedAi.url || null;
  const effectiveTags = parsedAi.tags || parsedAi.keywords || [];
  const effectiveDescription = parsedAi.description || parsedAi.summary || parsedAi.caption || "";

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] pb-20 transition-colors duration-500">
      
      {/* HEADER */}
      <div className="bg-white/80 dark:bg-[#1A1D21]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 px-6 py-6 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
              <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors font-medium text-sm">
                  <ArrowLeft size={18} className="mr-2" /> Back
              </button>
              
              <div className="flex items-center gap-3">
                  <button onClick={handleDownload} className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:scale-105 transition-transform">
                      <Download size={16} /> Download
                  </button>

                  {/* ✅ SHARE BUTTON (Visible to everyone) */}
                  <button onClick={handleShare} className="flex items-center gap-2 bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                      <Share2 size={16} /> Share
                  </button>

                  {/* ✅ DELETE BUTTON (Visible only to Owners/Admins) */}
                  {canManageAsset && (
                      <button 
                        onClick={() => setShowDeleteConfirm(true)} 
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete Asset"
                      >
                          <Trash2 size={20} />
                      </button>
                  )}
              </div>
          </div>
      </div>

      {loading || !asset ? (
          <DetailSkeleton />
      ) : (
          <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* LEFT: PREVIEW */}
              <div className="lg:col-span-2 space-y-12">
                  <div className="rounded-3xl overflow-hidden bg-gray-100 dark:bg-[#1A1D21] border border-gray-200 dark:border-white/5 shadow-sm">
                      {asset.mimeType.startsWith('image/') ? (
                          <img src={asset.path} alt={asset.originalName} className="w-full h-auto object-contain max-h-[80vh]" />
                      ) : asset.mimeType.startsWith('video/') ? (
                          <video 
                            src={asset.path} 
                            poster={asset.thumbnailPath || undefined} 
                            controls 
                            className="w-full h-auto max-h-[80vh]" 
                          />
                      ) : (
                          <div className="h-96 flex flex-col items-center justify-center text-gray-400">
                              <FileText size={64} />
                              <p className="mt-4 font-medium">Preview not available</p>
                          </div>
                      )}
                  </div>

                  {/* RELATED ASSETS SECTION */}
                  {isRelatedLoading ? (
                      <RelatedSkeleton />
                  ) : relatedAssets.length > 0 && (
                      <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">More Like This</h3>
                          <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-4" columnClassName="pl-4 bg-clip-padding">
                              {relatedAssets.map(item => (
                                  <div key={item.id} className="block mb-4 group cursor-pointer" onClick={() => navigate(`/assets/${item.id}`)}>
                                      <div className="rounded-xl overflow-hidden bg-gray-100 dark:bg-[#1A1D21] shadow-sm hover:shadow-md transition-all">
                                          <AssetThumbnail 
                                            mimeType={item.mimeType} 
                                            thumbnailPath={item.thumbnailPath || item.path} 
                                            className="w-full h-auto object-cover group-hover:opacity-90 transition-opacity" 
                                          />
                                      </div>
                                  </div>
                              ))}
                          </Masonry>
                      </div>
                  )}
              </div>

              {/* RIGHT: INFO PANEL */}
              <div className="space-y-6 min-w-0">
                  
                  {/* 1. TITLE & RENAME */}
                  <div className="group min-w-0">
                      {isRenaming ? (
                          <div className="flex items-center gap-2">
                              <input 
                                  type="text" 
                                  value={newName} 
                                  onChange={(e) => setNewName(e.target.value)} 
                                  autoFocus 
                                  className="w-full text-2xl font-bold bg-white dark:bg-[#1A1D21] border-b-2 border-blue-500 outline-none text-gray-900 dark:text-white pb-1 min-w-0"
                              />
                              <button onClick={handleRename} className="shrink-0 p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200"><Check size={18} /></button>
                              <button onClick={() => setIsRenaming(false)} className="shrink-0 p-2 bg-gray-100 dark:bg-white/10 text-gray-500 rounded-lg hover:bg-gray-200"><X size={18} /></button>
                          </div>
                      ) : (
                          <div className="flex items-start justify-between gap-2">
                              <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight break-words break-all line-clamp-3" title={asset.originalName || asset.filename}>
                                  {asset.originalName || asset.filename}
                              </h1>
                              {canManageAsset && (
                                  <button onClick={() => setIsRenaming(true)} className="shrink-0 ml-1 p-1.5 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Rename Asset">
                                      <Edit2 size={16} />
                                  </button>
                              )}
                          </div>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 font-medium mt-2">
                          <span className="flex items-center gap-1.5"><Calendar size={14}/> {new Date(asset.createdAt).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1.5"><HardDrive size={14}/> {(asset.size / 1024 / 1024).toFixed(2)} MB</span>
                          <span className="uppercase bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-[10px] tracking-wide">{asset.mimeType.split('/')[1]}</span>
                      </div>

                      {/* ASSET OWNER */}
                      <div className="flex items-center gap-2 mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-[10px] text-white font-bold shadow-sm shrink-0">
                              {asset.uploadedBy?.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <span className="truncate">
                              Uploaded by <span className="text-gray-900 dark:text-white font-bold">{asset.uploadedBy?.name || 'Unknown'}</span>
                          </span>
                      </div>
                  </div>

                  <hr className="border-gray-200 dark:border-white/10" />

                  {/* 2. ACTION BUTTONS */}
                  <div className={`grid gap-3 relative z-20 ${canAddToTopic ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <button 
                          onClick={() => openSelectionModal('collection')}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:border-blue-500 dark:hover:border-blue-400 bg-white dark:bg-[#1A1D21] text-gray-700 dark:text-gray-200 font-bold text-sm transition-all shadow-sm active:scale-95"
                      >
                          <FolderPlus size={18} className="text-blue-500" /> Collection
                      </button>

                      {canAddToTopic && (
                          <button 
                              onClick={() => openSelectionModal('topic')}
                              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:border-purple-500 dark:hover:border-purple-400 bg-white dark:bg-[#1A1D21] text-gray-700 dark:text-gray-200 font-bold text-sm transition-all shadow-sm active:scale-95"
                          >
                              <Layout size={18} className="text-purple-500" /> Topic
                          </button>
                      )}
                  </div>

                  {/* 3. GOOGLE DRIVE LINK */}
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl p-5 border border-blue-100 dark:border-blue-800/30">
                      <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-gray-800 dark:text-blue-100 flex items-center gap-2">
                              <ExternalLink size={16} /> Source Link
                          </h3>
                          {canManageAsset && (
                              <button onClick={() => setIsEditingLink(!isEditingLink)} className="text-xs font-bold text-blue-600 hover:underline">
                                  {isEditingLink ? 'Cancel' : 'Edit'}
                              </button>
                          )}
                      </div>

                      {isEditingLink ? (
                          <div className="flex gap-2">
                              <input 
                                  type="url" 
                                  value={driveLink} 
                                  onChange={e => setDriveLink(e.target.value)} 
                                  placeholder="Paste link..." 
                                  className="flex-1 text-sm bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                              />
                              <button onClick={saveDriveLink} disabled={isSavingLink} className="bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 disabled:opacity-50 shrink-0">
                                  <Check size={16} />
                              </button>
                          </div>
                      ) : effectiveLink ? (
                          <a 
                              href={effectiveLink} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex items-center justify-center gap-2 w-full bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 hover:border-blue-400 dark:hover:border-blue-500 text-gray-700 dark:text-gray-200 font-semibold py-3 rounded-xl shadow-sm transition-all hover:shadow-md group"
                          >
                              <LinkIcon size={16} className="text-blue-500 group-hover:rotate-45 transition-transform" />
                              Open Link
                          </a>
                      ) : (
                          <p className="text-xs text-gray-400 italic">No external link added.</p>
                      )}
                  </div>

                  {/* 4. DESCRIPTION */}
                  {effectiveDescription && (
                    <div className="min-w-0">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                        <CollapsibleText text={effectiveDescription} />
                    </div>
                  )}

                  {/* 5. TAGS */}
                  <div>
                      <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tags</h3>
                          {canManageAsset && !isAddingTag && (
                              <button onClick={() => setIsAddingTag(true)} className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-white/5 p-1 rounded transition-colors">
                                  <Plus size={14} />
                              </button>
                          )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                          {effectiveTags.length > 0 ? (
                            effectiveTags.map((tag: string) => (
                                <span key={tag} className="group flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/5 max-w-full">
                                    <Hash size={10} className="opacity-50 shrink-0" /> 
                                    <span className="truncate">{tag}</span>
                                    {canManageAsset && (
                                        <button onClick={() => handleRemoveTag(tag)} className="ml-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <X size={10} />
                                        </button>
                                    )}
                                </span>
                            ))
                          ) : (
                            <p className="text-xs text-gray-400 italic">No tags found.</p>
                          )}

                          {isAddingTag && (
                              <form onSubmit={handleAddTag} className="flex items-center">
                                  <input 
                                      autoFocus 
                                      type="text" 
                                      value={newTag} 
                                      onChange={e => setNewTag(e.target.value)} 
                                      onBlur={() => setIsAddingTag(false)} 
                                      className="text-xs bg-white dark:bg-black/20 border border-blue-500 rounded-full px-2 py-1 outline-none w-24" 
                                      placeholder="New tag..." 
                                  />
                              </form>
                          )}
                      </div>
                  </div>

              </div>
          </div>
      )}

      {/* SELECTION MODAL */}
      {activeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
              <div className="relative bg-white dark:bg-[#1A1D21] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
                      <h3 className="font-bold text-gray-900 dark:text-white">
                          Select {activeModal === 'collection' ? 'Collection' : 'Topic'}
                      </h3>
                      <button onClick={() => setActiveModal(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                          <X size={20} />
                      </button>
                  </div>

                  <div className="px-6 py-2">
                      <div className="flex items-center gap-2 bg-gray-50 dark:bg-black/20 rounded-xl px-3 py-2 border border-gray-100 dark:border-white/5">
                          <Search size={16} className="text-gray-400" />
                          <input 
                              type="text" 
                              placeholder="Search..." 
                              value={modalSearch}
                              onChange={(e) => setModalSearch(e.target.value)}
                              autoFocus
                              className="bg-transparent border-none outline-none text-sm w-full text-gray-800 dark:text-gray-200 placeholder-gray-400"
                          />
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                      {activeModal === 'collection' ? (
                          filteredCollections.length > 0 ? (
                              filteredCollections.map(c => (
                                  <button 
                                      key={c.id} 
                                      onClick={() => addToCollection(c.id, c.name)}
                                      disabled={!!addingToId} 
                                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors group
                                        ${addingToId && addingToId !== c.id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20'}
                                      `}
                                  >
                                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                          {addingToId === c.id ? <Loader2 size={18} className="animate-spin" /> : <FolderPlus size={18} />}
                                      </div>
                                      <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-300 truncate">{c.name}</span>
                                  </button>
                              ))
                          ) : <div className="p-6 text-center text-gray-400 text-sm">No collections found</div>
                      ) : (
                          filteredCategories.length > 0 ? (
                              filteredCategories.map(c => (
                                  <button 
                                      key={c.id} 
                                      onClick={() => addToTopic(c.id, c.name)}
                                      disabled={!!addingToId}
                                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors group
                                        ${addingToId && addingToId !== c.id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-50 dark:hover:bg-purple-900/20'}
                                      `}
                                  >
                                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                                          {addingToId === c.id ? <Loader2 size={18} className="animate-spin" /> : <Layout size={18} />}
                                      </div>
                                      <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-purple-700 dark:group-hover:text-purple-300 truncate">{c.name}</span>
                                  </button>
                              ))
                          ) : <div className="p-6 text-center text-gray-400 text-sm">No topics found</div>
                      )}
                  </div>
              </div>
          </div>
      )}

      <ConfirmModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={handleDelete} title="Delete Asset" message="This action cannot be undone." confirmText="Delete Forever" isDangerous={true} isLoading={isDeleting} />
    </div>
  );
};

export default AssetDetail;