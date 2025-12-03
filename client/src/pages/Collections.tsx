import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { Folder, Plus, Loader2 } from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  _count: { assets: number };
}

const Collections = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCollectionName, setNewCollectionName] = useState('');

  const fetchCollections = async () => {
    try {
      const { data } = await client.get('/collections');
      setCollections(data);
    } catch (error) {
      console.error(error);
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
      setNewCollectionName('');
      fetchCollections(); // Refresh list
    } catch (error) {
      alert('Failed to create collection');
    }
  };

  if (loading) return <div className="p-10"><Loader2 className="animate-spin" /></div>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Collections</h1>

      {/* Create New Bar */}
      <form onSubmit={handleCreate} className="mb-8 flex gap-2">
        <input
          type="text"
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          placeholder="New Collection Name (e.g. 'Social Media 2025')"
          className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
        />
        <button type="submit" className="flex items-center rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700">
          <Plus size={20} className="mr-1" /> Create
        </button>
      </form>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
        {collections.map((col) => (
            <Link 
            to={`/collections/${col.id}`} // <--- Wrap with Link
            key={col.id} 
            className="group relative flex flex-col items-center justify-center rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md hover:border-blue-300 cursor-pointer"
          >
          <div key={col.id} className="group relative flex flex-col items-center justify-center rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md">
            <Folder size={48} className="mb-2 text-blue-200 group-hover:text-blue-400" />
            <h3 className="font-semibold text-gray-800">{col.name}</h3>
            <p className="text-sm text-gray-500">{col._count.assets} assets</p>
            {/* Note: We will add linking logic later, for now just display */}
          </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Collections;