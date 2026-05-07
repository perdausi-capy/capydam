import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../components/CustomSelect';
import client from '../api/client';
import { toast } from 'react-toastify';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
    Layers, Cpu, Database, View, HardDrive,
    Monitor as MonitorIcon, Zap, Plus, Search, Package,
    Edit2, Trash2, Calendar, FileText, Hash, X, Tag, AlertCircle,
    Camera, Headphones, Keyboard, Cable, Plug, Wifi,
    BarChart2
} from 'lucide-react';

// --- TYPES ---
interface InventoryItem {
    id: string;
    itemName: string; // ✅ Added Item Name
    serialNumber: string;
    type: string;
    purchaseDate: string | null;
    status: string;
    notes: string | null;
    createdAt: string;
    workstation?: {
        unitId: string;
    } | null;
}

const inventoryCategories = [
    { id: 'MOBO', label: 'Motherboards', icon: Layers },
    { id: 'CPU', label: 'Processors', icon: Cpu },
    { id: 'GPU', label: 'Graphics Cards', icon: View },
    { id: 'RAM', label: 'Memory (RAM)', icon: Database },
    { id: 'STORAGE', label: 'Storage Drives', icon: HardDrive },
    { id: 'MONITOR', label: 'Monitors', icon: MonitorIcon },
    { id: 'PSU', label: 'Power Supplies', icon: Zap },
    { id: 'WEBCAM', label: 'Webcams', icon: Camera },
    { id: 'HEADSET', label: 'Headsets', icon: Headphones },
    { id: 'KEYBOARD', label: 'Keyboards', icon: Keyboard },
    { id: 'LAN_CABLE', label: 'LAN Cables', icon: Cable },
    { id: 'CABLE_ADAPTOR', label: 'Cable Adaptors', icon: Plug },
    { id: 'WIFI_ADAPTOR', label: 'Wifi Adaptors', icon: Wifi },
];

const ITTInventory = () => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState(inventoryCategories[0].id);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        itemName: '', // ✅ Added state
        serialNumber: '',
        type: inventoryCategories[0].id,
        purchaseDate: '',
        status: 'Active',
        notes: ''
    });

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const { data } = await client.get('/itt/inventory');
            setInventory(data);
        } catch (error) {
            toast.error('Failed to load inventory');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchInventory(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.itemName.trim() || !formData.serialNumber.trim()) {
            toast.warning("Item Name and Serial Number are required");
            return;
        }

        try {
            const payload = {
                ...formData,
                purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate).toISOString() : null,
            };

            if (editingId) {
                await client.put(`/itt/inventory/${editingId}`, payload);
                toast.success('Item updated');
            } else {
                await client.post('/itt/inventory', payload);
                toast.success('Item added to inventory');
            }
            closeModal();
            fetchInventory();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to permanently remove this item?')) return;
        try {
            const response = await client.delete(`/itt/inventory/${id}`);
            toast.success(response.data.message);
            fetchInventory();
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || "Failed to delete item";
            toast.error(errorMessage, {
                autoClose: 5000,
                icon: <AlertCircle className="text-red-500" />
            });
        }
    };

    const openModal = (item?: InventoryItem) => {
        if (item) {
            setEditingId(item.id);
            setFormData({
                itemName: item.itemName, // ✅ Load data
                serialNumber: item.serialNumber,
                type: item.type,
                purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : '',
                status: item.status,
                notes: item.notes || ''
            });
        } else {
            setEditingId(null);
            setFormData({
                itemName: '', // ✅ Clear data
                serialNumber: '',
                type: selectedCategory,
                purchaseDate: '',
                status: 'Active',
                notes: ''
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const matchesCategory = item.type === selectedCategory;
            const matchesSearch =
                item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesCategory && matchesSearch;
        });
    }, [inventory, selectedCategory, searchTerm]);

    // Category-level stats (all items in category, regardless of search)
    const categoryStats = useMemo(() => {
        const categoryItems = inventory.filter(item => item.type === selectedCategory);
        const deployed = categoryItems.filter(i => i.workstation != null && i.status !== 'Defective').length;
        const defective = categoryItems.filter(i => i.status === 'Defective').length;
        const available = categoryItems.filter(i => i.workstation == null && i.status !== 'Defective').length;
        const total = categoryItems.length;
        return { deployed, available, defective, total };
    }, [inventory, selectedCategory]);

    const chartData = [
        { name: 'Deployed', value: categoryStats.deployed, color: '#6366f1' },
        { name: 'Available', value: categoryStats.available, color: '#22c55e' },
        { name: 'Defective', value: categoryStats.defective, color: '#ef4444' },
    ];

    const activeCat = inventoryCategories.find(c => c.id === selectedCategory);
    const ActiveIcon = activeCat?.icon || Package;

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'active': return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400';
            case 'defective': return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400';
            case 'custom': return 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-[#121418] p-4 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                <div className="relative w-full md:w-64">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121418] shadow-sm hover:border-blue-500/50 transition-all text-left"
                    >
                        <span className="text-blue-500 dark:text-blue-400">
                            <ActiveIcon size={18} />
                        </span>
                        <span className="flex-1 text-sm font-bold text-gray-900 dark:text-white">
                            {activeCat?.label}
                        </span>
                        <div className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}>
                            <X size={14} className="rotate-45 text-gray-400" />
                        </div>
                    </button>

                    <AnimatePresence>
                        {isDropdownOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute top-full left-0 w-full mt-2 py-1.5 bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 max-h-72 overflow-y-auto custom-scrollbar"
                            >
                                {inventoryCategories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => {
                                            setSelectedCategory(cat.id);
                                            setIsDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors
                                            ${selectedCategory === cat.id
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                            }`}
                                    >
                                        <span className={selectedCategory === cat.id ? 'text-white' : 'text-blue-500 dark:text-blue-400'}>
                                            <cat.icon size={18} />
                                        </span>
                                        {cat.label}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search models or serials..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button onClick={() => openModal()} className="flex items-center justify-center gap-2 px-5 py-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm whitespace-nowrap text-sm">
                        <Plus size={16} /> Add Item
                    </button>
                </div>
            </div>

            {/* Category Stats + Chart */}
            <motion.div
                key={`stats-${selectedCategory}`}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                className="bg-white dark:bg-[#121418] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden"
            >
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <div className="flex items-center gap-2">
                        <BarChart2 size={18} className="text-blue-500" />
                        <span className="font-bold text-gray-800 dark:text-white text-sm">{activeCat?.label} — Inventory Overview</span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{categoryStats.total} total units</span>
                </div>

                <div className="grid grid-cols-3 gap-px bg-gray-100 dark:bg-white/5 border-t border-b border-gray-100 dark:border-white/5">
                    {/* Deployed */}
                    <div className="flex flex-col items-center justify-center gap-1 bg-white dark:bg-[#121418] py-4 px-2">
                        <span className="text-2xl font-black text-indigo-500">{categoryStats.deployed}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Deployed</span>
                        <div className="h-1 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                                style={{ width: categoryStats.total ? `${(categoryStats.deployed / categoryStats.total) * 100}%` : '0%' }}
                            />
                        </div>
                    </div>
                    {/* Available */}
                    <div className="flex flex-col items-center justify-center gap-1 bg-white dark:bg-[#121418] py-4 px-2">
                        <span className="text-2xl font-black text-green-500">{categoryStats.available}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Available</span>
                        <div className="h-1 w-12 rounded-full bg-green-100 dark:bg-green-900/30 overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full transition-all duration-700"
                                style={{ width: categoryStats.total ? `${(categoryStats.available / categoryStats.total) * 100}%` : '0%' }}
                            />
                        </div>
                    </div>
                    {/* Defective */}
                    <div className="flex flex-col items-center justify-center gap-1 bg-white dark:bg-[#121418] py-4 px-2">
                        <span className="text-2xl font-black text-red-500">{categoryStats.defective}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Defective</span>
                        <div className="h-1 w-12 rounded-full bg-red-100 dark:bg-red-900/30 overflow-hidden">
                            <div
                                className="h-full bg-red-500 rounded-full transition-all duration-700"
                                style={{ width: categoryStats.total ? `${(categoryStats.defective / categoryStats.total) * 100}%` : '0%' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Bar Chart */}
                <div className="px-4 pt-3 pb-4" style={{ height: 140 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barSize={40} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip
                                cursor={{ fill: 'rgba(128,128,128,0.05)' }}
                                contentStyle={{
                                    background: '#1a1d21',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    color: '#fff',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                                }}
                                labelStyle={{ fontWeight: 700, marginBottom: 2 }}
                            />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {chartData.map((entry) => (
                                    <Cell key={entry.name} fill={entry.color} fillOpacity={0.9} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            {/* Inventory Grid */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={selectedCategory}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
                    className="bg-white dark:bg-[#121418] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden min-h-[400px] flex flex-col"
                >
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/5 shrink-0 bg-gray-50/50 dark:bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl"><ActiveIcon size={20} /></div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{activeCat?.label} Stock</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage unassigned {activeCat?.label.toLowerCase()} inventory.</p>
                            </div>
                        </div>
                        <div className="text-sm font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 px-3 py-1 rounded-lg shadow-sm">
                            {filteredInventory.length} Items
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        {loading ? (
                            <div className="p-12 text-center text-gray-500">Loading inventory...</div>
                        ) : filteredInventory.length === 0 ? (
                            <div className="p-16 flex flex-col items-center justify-center text-center opacity-60">
                                <div className="bg-gray-100 dark:bg-black/40 p-5 rounded-full mb-4"><ActiveIcon size={32} className="text-gray-400 dark:text-gray-500" strokeWidth={1.5} /></div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No {activeCat?.label} Found</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Click "Add Item" to register a new component into the local inventory.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50/50 dark:bg-black/20 border-b border-gray-200 dark:border-white/10 text-xs uppercase font-bold text-gray-500">
                                    <tr>
                                        <th className="px-6 py-4">Item Details</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Deployment</th>
                                        <th className="px-6 py-4">Purchase Date</th>
                                        <th className="px-6 py-4 w-1/4">Notes</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {filteredInventory.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                {/* ✅ NEW: Merged Item Name & Serial */}
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900 dark:text-white text-sm">{item.itemName}</span>
                                                    <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                                        <Hash size={10} /> SN: {item.serialNumber}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${getStatusColor(item.status)}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                                {item.workstation ? (
                                                    <div className="flex items-center gap-2 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-100 dark:border-indigo-800/50 w-fit font-bold">
                                                        <MonitorIcon size={12} />
                                                        <span className="text-xs">{item.workstation.unitId}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-gray-400 uppercase font-bold italic">In Storage</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                                {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : <span className="italic text-gray-400 text-xs">Not recorded</span>}
                                            </td>
                                            <td className="px-6 py-4 truncate max-w-xs text-gray-600 dark:text-gray-400 text-xs">
                                                {item.notes || <span className="italic text-gray-400">No notes</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openModal(item)} className="p-1.5 text-gray-400 hover:text-blue-500 bg-white dark:bg-black/20 rounded border border-gray-200 dark:border-white/10" title="Edit"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 bg-white dark:bg-black/20 rounded border border-gray-200 dark:border-white/10" title="Delete"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-white/10">
                            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/[0.02]">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Package size={20} className="text-blue-500" />
                                    {editingId ? 'Edit Inventory Item' : 'Add to Inventory'}
                                </h2>
                                <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"><X size={20} /></button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                                <div className="grid grid-cols-2 gap-4">

                                    {/* ✅ NEW: Item Name */}
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                            Item Model / Name {formData.type === 'RAM' && <span className="text-blue-500 normal-case font-normal">(Include Size)</span>} <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input
                                                type="text"
                                                required
                                                autoFocus
                                                value={formData.itemName}
                                                onChange={e => setFormData({ ...formData, itemName: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white text-sm"
                                                placeholder={
                                                    formData.type === 'RAM' 
                                                        ? "e.g. Corsair Vengeance 32GB DDR5" 
                                                        : formData.type === 'CPU'
                                                        ? "e.g. Intel Core i7-13700K"
                                                        : formData.type === 'GPU'
                                                        ? "e.g. NVIDIA RTX 4080"
                                                        : formData.type === 'STORAGE'
                                                        ? "e.g. Samsung 980 Pro 1TB NVMe"
                                                        : formData.type === 'MONITOR'
                                                        ? "e.g. Dell UltraSharp U2723QE 27\""
                                                        : "e.g. Corsair RM850x 850W"
                                                }
                                            />
                                        </div>
                                        {formData.type === 'RAM' && (
                                            <p className="text-[10px] text-blue-500 mt-1 flex items-center gap-1">
                                                <AlertCircle size={10} /> Please include RAM size (e.g., 8GB, 16GB, 32GB) in the item name
                                            </p>
                                        )}
                                    </div>

                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Serial Number <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input
                                                type="text"
                                                required
                                                value={formData.serialNumber}
                                                onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white text-sm"
                                                placeholder="e.g. SN-987654"
                                            />
                                        </div>
                                    </div>

                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Component Type <span className="text-red-500">*</span></label>
                                        <CustomSelect
                                            required
                                            value={formData.type}
                                            onChange={val => setFormData({ ...formData, type: val })}
                                            options={inventoryCategories.map(c => {
                                                const Icon = c.icon;
                                                return { value: c.id, label: c.label, icon: <Icon size={14} className="text-blue-500" /> };
                                            })}
                                        />
                                    </div>

                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Purchase Date</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input
                                                type="date"
                                                value={formData.purchaseDate}
                                                onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                                        <CustomSelect
                                            value={formData.status}
                                            onChange={val => setFormData({ ...formData, status: val })}
                                            options={[
                                                { value: "Active", label: "Active" },
                                                { value: "Available", label: "Available" },
                                                { value: "Defective", label: "Defective" }
                                            ]}
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notes / Specs</label>
                                        <div className="relative">
                                            <FileText className="absolute left-3 top-3 text-gray-400" size={16} />
                                            <textarea
                                                rows={3}
                                                value={formData.notes}
                                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white text-sm placeholder:text-gray-400 resize-none"
                                                placeholder="e.g. Waiting for RMA..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={closeModal} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-sm">Cancel</button>
                                    <button type="submit" className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md text-sm">
                                        {editingId ? 'Save Changes' : 'Add Item'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ITTInventory;
