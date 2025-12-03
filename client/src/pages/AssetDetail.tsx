import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { ArrowLeft, Save, Tag, FileText, Calendar, Trash2, FolderPlus } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from 'react-toastify';


interface AssetData {
  id: string;
  filename: string; 
  mimeType: string;
  originalName: string;
  path: string;
  aiData: string; // JSON string
  createdAt: string;
  uploadedBy: { name: string };
}

const AssetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  // Form State
  const [asset, setAsset] = useState<AssetData | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState(''); // Comma separated string for editing
  const [collections, setCollections] = useState<{id: string, name: string}[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(''); // Track selected collection for adding to

  // 1. Change handleDelete to just OPEN the modal
  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  // 2. Create the actual Action function
  const confirmDelete = async () => {
    if (!asset) return;
    setDeleting(true);
    try {
      await client.delete(`/assets/${asset.id}`);
      toast.success('Asset deleted permanently');
      navigate('/'); 
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete asset');
      setDeleting(false); // Stop loading if error
      setIsDeleteModalOpen(false); // Close modal
    }
  };

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        const { data } = await client.get(`/assets/${id}`);
        setAsset(data);
        
        // Initialize Form
        setTitle(data.originalName);
        
        if (data.aiData) {
          try {
            const parsed = JSON.parse(data.aiData);
            setDescription(parsed.description || '');
            setTagsInput(parsed.tags?.join(', ') || '');
          } catch (e) {
            console.error("Error parsing AI data", e);
          }
        }
      } catch (error) {
        console.error("Failed to load asset");
      } finally {
        setLoading(false);
      }
    };
    fetchAsset();
  }, [id]);

  const handleSave = async () => {
    if (!asset) return;
    setSaving(true);
    
    try {
      // Reconstruct the AI Data object
      const updatedAiData = {
        description,
        tags: tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0),
        // Preserve colors if they existed, or other fields you might add later
        colors: asset.aiData ? JSON.parse(asset.aiData).colors : []
      };

      await client.patch(`/assets/${asset.id}`, {
        originalName: title,
        aiData: updatedAiData
      });
      
      toast.success('Changes saved successfully!');
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!asset) return;
    
    // Simple confirmation
    if (!window.confirm('Are you sure you want to permanently delete this asset? This cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      await client.delete(`/assets/${asset.id}`);
      toast.success('Asset deleted permanently');
      navigate('/'); // Return to dashboard
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete asset');
      setDeleting(false);
    }
  };

  // Fetch collections on mount
useEffect(() => {
    const loadCollections = async () => {
      const { data } = await client.get('/collections');
      setCollections(data);
    };
    loadCollections();
    // ... existing fetchAsset call
  }, [id]);
  
  const addToCollection = async () => {
    if (!selectedCollectionId) return;
    try {
      await client.post(`/collections/${selectedCollectionId}/assets`, {
        assetId: id
      });
      alert('Added to collection!');
    } catch (error) {
      alert('Asset already in this collection');
    }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;
  if (!asset) return <div className="p-10 text-center">Asset not found</div>;

  return (
    <div>
      {/* Back Button */}
      <button 
        onClick={() => navigate('/')}
        className="mb-6 flex items-center text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft size={20} className="mr-2" />
        Back to Library
      </button>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: Image Preview */}
        {/* Left: Media Preview */}
        <div className="flex items-center justify-center rounded-xl bg-gray-100 p-4 border min-h-[400px]">
           {asset.mimeType.startsWith('image/') ? (
             <img
               src={`http://localhost:5000/${asset.path}`}
               alt={asset.originalName}
               className="max-h-[80vh] max-w-full rounded shadow-sm object-contain"
             />
           ) : asset.mimeType.startsWith('video/') ? (
             <video 
               controls 
               className="max-h-[80vh] max-w-full rounded shadow-sm"
               src={`http://localhost:5000/${asset.path}`}
             >
               Your browser does not support the video tag.
             </video>
           ) : asset.mimeType === 'application/pdf' ? (
             <iframe
               src={`http://localhost:5000/${asset.path}`}
               className="h-[80vh] w-full rounded border"
             />
           ) : (
             <div className="text-center">
               <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                 <FileText size={48} />
               </div>
               <p className="mb-4 text-gray-500">Preview not available for this file type.</p>
               <a 
                 href={`http://localhost:5000/${asset.path}`}
                 download={asset.originalName}
                 className="rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
               >
                 Download File
               </a>
             </div>
           )}
        </div>

        {/* Right: Metadata Editor */}
        <div className="space-y-6">
          
          {/* Title Edit */}
          <div>
             <label className="mb-1 block text-sm font-medium text-gray-700">Filename / Title</label>
             <input
               type="text"
               value={title}
               onChange={(e) => setTitle(e.target.value)}
               className="w-full rounded-lg border border-gray-300 p-2.5 text-lg font-bold text-gray-900 focus:border-blue-500 focus:ring-blue-500"
             />
          </div>

          {/* Metadata Cards */}
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
             <div className="flex items-center">
                <Calendar size={16} className="mr-2" />
                {new Date(asset.createdAt).toLocaleDateString()}
             </div>
             <div className="flex items-center">
                <FileText size={16} className="mr-2" />
                Uploaded by {asset.uploadedBy?.name || 'Unknown'}
             </div>
          </div>

          <hr />

          {/* Description Edit */}
          <div>
             <label className="mb-1 block text-sm font-medium text-gray-700">AI Description</label>
             <textarea
               rows={3}
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               className="w-full rounded-lg border border-gray-300 p-2.5 text-gray-700 focus:border-blue-500 focus:ring-blue-500"
             />
          </div>

          {/* Tags Edit */}
          <div>
             <label className="mb-1 flex items-center text-sm font-medium text-gray-700">
               <Tag size={16} className="mr-2" />
               Tags (comma separated)
             </label>
             <input
               type="text"
               value={tagsInput}
               onChange={(e) => setTagsInput(e.target.value)}
               placeholder="nature, sky, blue..."
               className="w-full rounded-lg border border-gray-300 p-2.5 text-gray-700 focus:border-blue-500 focus:ring-blue-500"
             />
             <p className="mt-1 text-xs text-gray-400">Edit tags manually to correct the AI.</p>
          </div>

          {/* Collections Section */}
          <div className="rounded-lg border bg-gray-50 p-4">
             <label className="mb-2 block text-sm font-medium text-gray-700">Add to Collection</label>
             <div className="flex gap-2">
               <select 
                 className="w-full rounded-lg border border-gray-300 p-2"
                 value={selectedCollectionId}
                 onChange={(e) => setSelectedCollectionId(e.target.value)}
               >
                 <option value="">Select Collection...</option>
                 {collections.map(c => (
                   <option key={c.id} value={c.id}>{c.name}</option>
                 ))}
               </select>
               <button 
                 onClick={addToCollection}
                 className="rounded-lg bg-gray-200 px-3 py-2 hover:bg-gray-300"
               >
                 <FolderPlus size={20} className="text-gray-700" />
               </button>
             </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={20} className="mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {/* Delete Button - Add margin top */}
          <button
            onClick={handleDeleteClick}
            disabled={saving || deleting}
            className="mt-4 flex w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 px-5 py-3 font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 size={20} className="mr-2" />
            {deleting ? 'Deleting...' : 'Delete Asset'}
          </button>

          <ConfirmModal 
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={confirmDelete}
            title="Delete Asset"
            message="Are you sure you want to permanently delete this asset? This action cannot be undone and the file will be removed from storage."
            confirmText="Yes, Delete It"
            isDangerous={true}
            isLoading={deleting}
          />
        </div>
      </div>
    </div>
  );
};

export default AssetDetail;