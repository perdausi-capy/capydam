import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { 
  ArrowLeft, 
  Trash2, 
  FolderOpen, 
  Folder, 
  Share2,
  Calendar,
  Image as ImageIcon,
  Plus,
  X,
  FolderPlus, 
  Download,
  Search,
  Move,
  Check, 
  CheckSquare,
  Loader2 // Imported Loader
} from 'lucide-react';
import Masonry from 'react-masonry-css';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from 'react-toastify';
import AssetThumbnail from '../components/AssetThumbnail'; 
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

// --- TYPES ---
interface Asset {
  id: string;
  filename: string;
  thumbnailPath: string | null;
  mimeType: string; 
  originalName: string;
  uploadedBy: { name: string };
  path: string;
}

interface SubCollection {
  id: string;
  name: string;
  _count: { assets: number };
}

interface CollectionData {
  id: string;
  name: string;
  assets: Asset[];
  children: SubCollection[];
  createdAt?: string;
}

const cleanFilename = (name: string) => name.replace(/\.[^/.]+$/, "");

// --- 🦴 SKELETON ---
const CollectionDetailSkeleton = () => (
    <div className="animate-pulse">
        <div className="bg-white/80 dark:bg-[#1A1D21]/80 border-b border-gray-200 dark:border-white/5 px-6 py-8 md:px-10">
            <div className="mx-auto max-w-7xl">
                <div className="h-4 w-16 bg-gray-200 dark:bg-white/5 rounded mb-6" />
                <div className="flex gap-5">
                    <div className="h-20 w-20 rounded-2xl bg-gray-200 dark:bg-white/5 shrink-0" />
                    <div className="space-y-3 pt-2">
                        <div className="h-8 w-64 bg-gray-200 dark:bg-white/5 rounded" />
                        <div className="h-4 w-32 bg-gray-200 dark:bg-white/5 rounded" />
                    </div>
                </div>
            </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 space-y-10">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="aspect-square rounded-xl bg-gray-200 dark:bg-white/5" />)}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="aspect-[3/4] rounded-2xl bg-gray-200 dark:bg-white/5" />)}
            </div>
        </div>
    </div>
);

const CollectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // ✅ DATA FETCHING
  const { data: collection, isLoading: loading } = useQuery({
      queryKey: ['collection', id],
      queryFn: async () => {
          const { data } = await client.get<CollectionData>(`/collections/${id}`);
          return data;
      },
      refetchOnMount: 'always', 
      staleTime: 0, 
  });
  
  // ✅ STATE
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null); 
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [assetToMove, setAssetToMove] = useState<string | null>(null); 
  const [moveSearch, setMoveSearch] = useState('');
  
  // ✅ GLOBAL PROCESSING STATE (For Drag & Drop Loader)
  const [isProcessing, setIsProcessing] = useState(false); 
  
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // ✅ MULTI-SELECT STATE
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false); 
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Drag State
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [assetToRemove, setAssetToRemove] = useState<string | null>(null);

  const canManage = user?.role === 'admin' || user?.role === 'editor'; 

  // --- 🛠️ MUTATIONS ---
  const deleteMutation = useMutation({
      mutationFn: async (assetIds: string[]) => {
          const promises = assetIds.map(assetId => client.delete(`/collections/${id}/assets/${assetId}`));
          await Promise.all(promises);
          return assetIds;
      },
      onMutate: async (deletedIds) => {
          await queryClient.cancelQueries({ queryKey: ['collection', id] });
          const previousData = queryClient.getQueryData(['collection', id]);
          queryClient.setQueryData(['collection', id], (old: CollectionData | undefined) => {
              if (!old) return old;
              return { ...old, assets: old.assets.filter(a => !deletedIds.includes(a.id)) };
          });
          return { previousData };
      },
      onError: (err, newTodo, context) => {
          queryClient.setQueryData(['collection', id], context?.previousData);
          toast.error("Failed to delete assets");
      },
      onSettled: () => {
          queryClient.invalidateQueries({ queryKey: ['collection'] });
          setSelectedIds(new Set());
          setAssetToRemove(null);
          setShowBulkDeleteConfirm(false);
          setIsSelectionMode(false);
          toast.success("Assets removed");
      }
  });

  // --- ACTIONS ---

  // ✅ UNIFIED MOVE FUNCTION (Handles Single, Bulk, and Drag)
  const addToSubCollection = async (targetId: string, targetName: string, specificAssetIds?: string[]) => {
    let idsToMove: string[] = [];

    // 1. Determine what we are moving
    if (specificAssetIds && specificAssetIds.length > 0) {
        // Passed explicitly (e.g. from Drag Drop)
        idsToMove = specificAssetIds;
    } else if (selectedIds.size > 0) {
        // Bulk Selection
        idsToMove = Array.from(selectedIds);
    } else if (assetToMove) {
        // Single Modal Move
        idsToMove = [assetToMove];
    } else if (activeDropdownId) {
        // Dropdown Move
        idsToMove = [activeDropdownId];
    }

    if (idsToMove.length === 0) return;

    // 2. Show Loading Overlay
    setIsProcessing(true); 

    try {
        // 3. Perform Moves
        await Promise.all(idsToMove.map(assetId => client.post(`/collections/${targetId}/assets`, { assetId })));
        
        toast.success(`Moved ${idsToMove.length} item(s) to ${targetName}`);
        
        // 4. Optimistic Update (Remove from current view instantly)
        queryClient.setQueryData(['collection', id], (old: CollectionData | undefined) => {
            if (!old) return old;
            return { ...old, assets: old.assets.filter(a => !idsToMove.includes(a.id)) };
        });
        
        // 5. Cleanup UI States
        setMoveModalOpen(false);
        setSelectedIds(new Set());
        setActiveDropdownId(null);
        setDraggedAssetId(null);
        setAssetToMove(null);
        setIsSelectionMode(false);
        
        // 6. Refresh Data
        queryClient.invalidateQueries({ queryKey: ['collection'] });
    } catch (error) { 
        toast.error("Move failed"); 
    } finally {
        setIsProcessing(false); // Hide Loading Overlay
    }
  };

  const toggleSelection = (e: React.MouseEvent, assetId: string) => {
      e.preventDefault(); e.stopPropagation();
      const newSet = new Set(selectedIds);
      if (newSet.has(assetId)) newSet.delete(assetId);
      else newSet.add(assetId);
      setSelectedIds(newSet);
      if (newSet.size > 0 && !isSelectionMode) setIsSelectionMode(true);
  };

  const handleCreateSubFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
        await client.post('/collections', { name: newFolderName, parentId: id });
        toast.success(`Folder "${newFolderName}" created`);
        setIsCreateFolderOpen(false);
        setNewFolderName('');
        queryClient.invalidateQueries({ queryKey: ['collection'] });
    } catch (error) { toast.error("Failed to create folder"); } 
    finally { setCreatingFolder(false); }
  };

  const confirmSingleRemove = () => { if (assetToRemove) deleteMutation.mutate([assetToRemove]); };
  const confirmBulkRemove = () => { deleteMutation.mutate(Array.from(selectedIds)); };

  const handleDownload = async (asset: Asset) => {
    try {
      toast.info('Downloading...', { autoClose: 1000 });
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
    } catch (err) { toast.error('Download failed'); }
  };

  // --- 🔥 DRAG AND DROP (ENHANCED) ---
  const handleDragStart = (e: React.DragEvent, assetId: string) => {
      if (!canManage) return;
      
      // If we are dragging an item that is part of the selection, we are moving the WHOLE selection
      if (selectedIds.has(assetId)) {
          // Do not clear selection, we are about to bulk move
      } else {
           // Standard single drag
           setDraggedAssetId(assetId);
      }
      
      e.dataTransfer.effectAllowed = "move";
      // Optional: Set custom drag image here if you want
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
      e.preventDefault();
      if (!canManage) return;
      setDragOverFolderId(folderId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverFolderId(null);
  };

  const handleDrop = async (e: React.DragEvent, folderId: string, folderName: string) => {
      e.preventDefault();
      setDragOverFolderId(null);
      
      // 1. Check: Are we dragging a single item that IS NOT in the selection?
      if (draggedAssetId && !selectedIds.has(draggedAssetId)) {
          await addToSubCollection(folderId, folderName, [draggedAssetId]);
          setDraggedAssetId(null);
      } 
      // 2. Check: Are we dragging items from the Multi-Selection?
      else if (selectedIds.size > 0) {
           // We infer that if selectedIds > 0 and a drop happened, we move the selection
           await addToSubCollection(folderId, folderName, Array.from(selectedIds));
      }
  };

  const toggleDropdown = (e: React.MouseEvent, assetId: string) => {
    e.preventDefault(); e.stopPropagation();
    setActiveDropdownId(activeDropdownId === assetId ? null : assetId);
  };

  const openMoveModal = (e: React.MouseEvent, assetId: string) => {
      e.preventDefault(); e.stopPropagation();
      setAssetToMove(assetId); 
      setMoveSearch('');
      setMoveModalOpen(true);
  };

  const filteredFolders = collection?.children.filter(f => f.name.toLowerCase().includes(moveSearch.toLowerCase())) || [];
  const breakpointColumnsObj = { default: 5, 1536: 4, 1280: 3, 1024: 3, 768: 2, 640: 1 };

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] pb-32 transition-colors duration-500 relative overflow-hidden">
      
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-indigo-400/10 dark:bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-400/10 dark:bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      {activeDropdownId && <div className="fixed inset-0 z-40 cursor-default" onClick={() => setActiveDropdownId(null)} />}

      {/* ✅ GLOBAL PROCESSING LOADER */}
      <AnimatePresence>
        {isProcessing && (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm"
            >
                <div className="bg-white dark:bg-[#1A1D21] p-6 rounded-2xl shadow-2xl flex flex-col items-center border border-gray-100 dark:border-white/10">
                    <Loader2 size={48} className="animate-spin text-blue-600 dark:text-blue-400 mb-4" />
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Processing...</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Moving your assets safely.</p>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
          <CollectionDetailSkeleton />
      ) : !collection ? (
          <div className="p-20 text-center dark:text-white relative z-10">Collection Not Found</div>
      ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10">
              <div className="bg-white/80 dark:bg-[#1A1D21]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 px-6 py-8 md:px-10 sticky top-0 z-20 transition-colors">
                  <div className="mx-auto max-w-7xl">
                    <button onClick={() => navigate(-1)} className="group mb-6 flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        <div className="mr-2 rounded-full p-1 group-hover:bg-blue-50 dark:group-hover:bg-white/10 transition-colors"><ArrowLeft size={16} /></div> Back
                    </button>

                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                        <div className="flex items-start gap-5">
                            <div className="hidden md:flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 shadow-sm">
                                <FolderOpen size={40} strokeWidth={1.5} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{collection.name}</h1>
                                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-1.5"><ImageIcon size={14} /> {collection.assets.length} items</span>
                                    {collection.createdAt && <span className="flex items-center gap-1.5"><Calendar size={14} /> Created {new Date(collection.createdAt).toLocaleDateString()}</span>}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {canManage && (
                                <>
                                    <button onClick={() => setIsCreateFolderOpen(true)} className="flex items-center gap-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2 text-sm font-bold shadow-sm hover:scale-105 transition-all">
                                        <Plus size={16} /> New Folder
                                    </button>
                                    
                                    <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }} className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold shadow-sm transition-all ${isSelectionMode ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300' : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10'}`}>
                                        <CheckSquare size={16} /> {isSelectionMode ? 'Done' : 'Select'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                  </div>
              </div>

              <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
                {collection.children && collection.children.length > 0 && (
                    <div className="mb-10">
                        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Folders</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {collection.children.map(sub => (
                                <Link 
                                    to={`/collections/${sub.id}`} 
                                    key={sub.id}
                                    onDragOver={(e) => handleDragOver(e, sub.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, sub.id, sub.name)}
                                    className={`group flex flex-col items-center justify-center p-4 rounded-xl border transition-all aspect-square relative ${dragOverFolderId === sub.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105 shadow-xl ring-2 ring-blue-500' : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1D21] hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'}`}
                                >
                                    <Folder size={40} className={`transition-colors ${dragOverFolderId === sub.id ? 'text-blue-600 dark:text-blue-400 fill-blue-600/20' : 'text-blue-200 dark:text-blue-900 group-hover:text-blue-500 dark:group-hover:text-blue-400 fill-current'}`} />
                                    <span className="mt-3 font-semibold text-gray-700 dark:text-gray-200 text-sm truncate w-full text-center relative z-10">{sub.name}</span>
                                    <span className="text-[10px] text-gray-400 relative z-10">{sub._count.assets} items</span>
                                    {dragOverFolderId === sub.id && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 dark:bg-blue-500/20 rounded-xl">
                                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-white/90 dark:bg-black/60 px-2 py-1 rounded-md shadow-sm">Drop to Move</span>
                                        </div>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {collection.assets.length > 0 && (
                     <>
                         <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Assets</h3>
                         <Masonry breakpointCols={breakpointColumnsObj} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
                            {collection.assets.map((asset) => {
                                const isSelected = selectedIds.has(asset.id);
                                return (
                                <div 
                                    key={asset.id} 
                                    // ✅ Allow drag if managed, EVEN IF in selection mode (for bulk drag)
                                    draggable={canManage}
                                    onDragStart={(e) => handleDragStart(e, asset.id)}
                                    onClick={(e) => isSelectionMode && toggleSelection(e, asset.id)}
                                    className={`group relative mb-8 block transition-all duration-300 cursor-pointer ${draggedAssetId === asset.id ? 'opacity-40 scale-95 grayscale' : 'opacity-100'}`}
                                    style={{ contentVisibility: 'auto', containIntrinsicSize: '300px' }} 
                                >
                                    {/* SELECTION CIRCLE */}
                                    <div 
                                        onClick={(e) => toggleSelection(e, asset.id)}
                                        className={`
                                            absolute top-3 left-3 z-30 rounded-full cursor-pointer transition-all duration-200 flex items-center justify-center shadow-lg
                                            ${isSelected 
                                                ? 'bg-blue-600 border-2 border-blue-600 text-white w-7 h-7 scale-110' // Selected
                                                : isSelectionMode
                                                    ? 'bg-black/20 backdrop-blur-sm border-2 border-white/80 w-7 h-7' // Unselected (Mode Active)
                                                    : 'bg-black/20 backdrop-blur-sm border-2 border-white/80 opacity-0 group-hover:opacity-100 w-7 h-7' // Hidden
                                            }
                                        `}
                                    >
                                        {isSelected && <Check size={14} strokeWidth={3} />}
                                    </div>

                                    {/* Card Container */}
                                    <div className={`
                                        relative w-full rounded-2xl overflow-hidden transition-all duration-300 bg-gray-100 dark:bg-[#1A1D21] shadow-sm
                                        ${isSelected ? 'ring-4 ring-blue-600 scale-[0.98]' : 'hover:shadow-md'} 
                                        ${activeDropdownId === asset.id ? 'ring-4 ring-blue-500/20' : ''}
                                    `}>
                                        <Link to={`/assets/${asset.id}`} className="block" onClick={(e) => isSelectionMode && e.preventDefault()}>
                                            <div className="relative w-full h-full">
                                                <AssetThumbnail mimeType={asset.mimeType} thumbnailPath={asset.thumbnailPath || asset.path} className="w-full h-auto block" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 pointer-events-none" />
                                            </div>
                                        </Link>
                                    </div>

                                    {!isSelectionMode && (
                                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                            {canManage && (
                                                <button onClick={(e) => openMoveModal(e, asset.id)} className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-md transition-colors hover:bg-blue-600 hover:text-white" title="Move to Folder"><FolderPlus size={16} /></button>
                                            )}
                                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownload(asset); }} className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-md transition-colors hover:bg-blue-600 hover:text-white"><Download size={16} /></button>
                                            {canManage && (
                                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAssetToRemove(asset.id); }} className="rounded-full bg-white/90 dark:bg-black/60 p-2 text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur-md transition-colors hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"><Trash2 size={16} /></button>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-3 px-1">
                                        <p className="truncate font-bold text-sm text-gray-800 dark:text-gray-100" title={asset.originalName}>{cleanFilename(asset.originalName)}</p>
                                    </div>
                                </div>
                            );
                            })}
                        </Masonry>
                     </>
                )}
              </div>
          </motion.div>
      )}

      <AnimatePresence>
        {selectedIds.size > 0 && (
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 p-2 pl-6 bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 shadow-2xl rounded-full">
                <span className="font-bold text-gray-700 dark:text-white whitespace-nowrap">{selectedIds.size} Selected</span>
                <div className="h-6 w-px bg-gray-300 dark:bg-white/20 mx-2" />
                <button onClick={() => setMoveModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-blue-50 dark:hover:bg-white/10 text-blue-600 dark:text-blue-400 font-medium transition-colors"><Move size={18} /> Move</button>
                <button onClick={() => setShowBulkDeleteConfirm(true)} className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 font-medium transition-colors"><Trash2 size={18} /> Remove</button>
                <button onClick={() => { setSelectedIds(new Set()); setIsSelectionMode(false); }} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X size={20} /></button>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {moveModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isProcessing && setMoveModalOpen(false)} />
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                    
                    {/* ✅ MODAL LOADING OVERLAY */}
                    {isProcessing && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm">
                            <Loader2 size={40} className="animate-spin text-blue-600 dark:text-blue-400 mb-2" />
                            <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Moving items...</p>
                        </div>
                    )}

                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
                        <h3 className="font-bold text-gray-900 dark:text-white">Move {selectedIds.size > 0 ? selectedIds.size : 'Asset'} Items</h3>
                        <button onClick={() => setMoveModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" disabled={isProcessing}><X size={20} /></button>
                    </div>
                    <div className="px-6 py-3 bg-gray-50 dark:bg-white/5">
                        <div className="flex items-center gap-2 bg-white dark:bg-black/20 rounded-xl px-3 py-2 border border-gray-200 dark:border-white/10">
                            <Search size={16} className="text-gray-400" />
                            <input type="text" placeholder="Find a folder..." autoFocus value={moveSearch} onChange={(e) => setMoveSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full text-gray-800 dark:text-gray-200 placeholder-gray-400" disabled={isProcessing} />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {filteredFolders.length > 0 ? ( 
                            filteredFolders.map(sub => (
                                <button key={sub.id} onClick={() => addToSubCollection(sub.id, sub.name)} disabled={isProcessing} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left transition-colors group disabled:opacity-50">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-110 transition-transform"><Folder size={18} /></div>
                                    <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{sub.name}</span>
                                </button>
                            ))
                        ) : ( <div className="p-8 text-center text-gray-400 text-sm">{collection?.children.length === 0 ? "No sub-folders created yet." : "No matching folders found."}</div> )}
                    </div>
                    <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
                        <button onClick={() => { setMoveModalOpen(false); setIsCreateFolderOpen(true); }} disabled={isProcessing} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-3 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"><Plus size={16} /> Create New Folder</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {isCreateFolderOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateFolderOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-sm bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-white/10">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">New Folder</h3>
                    <button onClick={() => setIsCreateFolderOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600 dark:hover:text-white" /></button>
                </div>
                <form onSubmit={handleCreateSubFolder}>
                    <input autoFocus type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 mb-4" placeholder="Folder Name" />
                    <button type="submit" disabled={creatingFolder} className="w-full rounded-xl bg-blue-600 text-white font-bold py-3 hover:bg-blue-700 transition-colors disabled:opacity-70">{creatingFolder ? 'Creating...' : 'Create Folder'}</button>
                </form>
            </motion.div>
        </div>
      )}

      <ConfirmModal isOpen={!!assetToRemove} onClose={() => setAssetToRemove(null)} onConfirm={confirmSingleRemove} title="Remove Asset" message="Remove from this collection?" confirmText="Remove" isDangerous={true} isLoading={deleteMutation.isPending} />
      <ConfirmModal isOpen={showBulkDeleteConfirm} onClose={() => setShowBulkDeleteConfirm(false)} onConfirm={confirmBulkRemove} title={`Remove ${selectedIds.size} Assets`} message="Are you sure you want to remove these items?" confirmText="Remove Selected" isDangerous={true} isLoading={deleteMutation.isPending} />
    </div>
  );
};

export default CollectionDetail;