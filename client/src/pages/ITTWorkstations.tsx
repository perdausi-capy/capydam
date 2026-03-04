import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, Cpu, HardDrive, Monitor as MonitorIcon, Search, Hash, Activity, Layers, Database, View, Zap, User } from 'lucide-react';

interface User {
    id: string;
    name: string;
    email: string;
}

interface Workstation {
    id: string;
    unitId: string;
    mobo: string;
    cpu: string;
    ram: string;
    gpu: string;
    psu: string;
    storage: string;
    monitor: string;
    status: string;
    assignedTo?: User;
}

const ITTWorkstations = () => {
    const [workstations, setWorkstations] = useState<Workstation[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        unitId: '', mobo: '', cpu: '', ram: '', gpu: '', psu: '', storage: '', monitor: '', status: 'active', assignedToId: ''
    });

    const fetchData = async () => {
        try {
            const [wsRes, usersRes] = await Promise.all([
                client.get('/itt/workstations'),
                client.get('/users') // Get users for assignment dropdown
            ]);
            setWorkstations(wsRes.data);
            setUsers(usersRes.data.data || usersRes.data);
        } catch (error) {
            toast.error('Failed to load workstations data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.unitId) {
            toast.warning("Unit ID is required");
            return;
        }

        try {
            const payload = { ...formData, assignedToId: formData.assignedToId || null };

            if (editingId) {
                await client.put(`/itt/workstations/${editingId}`, payload);
                toast.success('Workstation updated');
            } else {
                await client.post('/itt/workstations', payload);
                toast.success('Workstation created');
            }

            closeModal();
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this workstation?')) return;
        try {
            await client.delete(`/itt/workstations/${id}`);
            toast.success('Workstation deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete workstation');
        }
    };

    const openModal = (ws?: Workstation) => {
        if (ws) {
            setEditingId(ws.id);
            setFormData({
                unitId: ws.unitId || '',
                mobo: ws.mobo || '',
                cpu: ws.cpu || '',
                ram: ws.ram || '',
                gpu: ws.gpu || '',
                psu: ws.psu || '',
                storage: ws.storage || '',
                monitor: ws.monitor || '',
                status: ws.status || 'active',
                assignedToId: ws.assignedTo?.id || ''
            });
        } else {
            setEditingId(null);
            setFormData({
                unitId: '', mobo: '', cpu: '', ram: '', gpu: '', psu: '', storage: '', monitor: '', status: 'active', assignedToId: ''
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const filteredWorkstations = workstations.filter(ws =>
        ws.unitId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ws.assignedTo?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search unit ID or assignee..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#121418] border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                >
                    <Plus size={18} /> Add Workstation
                </button>
            </div>

            {/* Table grid */}
            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : filteredWorkstations.length === 0 ? (
                <div className="text-center py-20 bg-white/50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-300 dark:border-white/10">
                    <HardDrive size={40} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Workstations Found</h3>
                    <p className="text-gray-500">Create your first hardware inventory entry.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredWorkstations.map(ws => (
                        <div key={ws.id} className="bg-white dark:bg-[#121418] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                        <MonitorIcon size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">{ws.unitId}</h3>
                                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${ws.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                                            ws.status === 'maintenance' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                                                'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                                            }`}>
                                            {ws.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openModal(ws)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-white/5 rounded"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(ws.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-white/5 rounded"><Trash2 size={16} /></button>
                                </div>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><Cpu size={14} className="text-gray-400" /> {ws.cpu || 'N/A'}</div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><HardDrive size={14} className="text-gray-400" /> {ws.ram} RAM • {ws.storage} Storage</div>
                            </div>

                            <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Assigned To:</span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {ws.assignedTo ? ws.assignedTo.name : 'Unassigned'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1A1D21] rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-white/10">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingId ? 'Edit Workstation' : 'Add Workstation'}
                            </h2>
                            <button onClick={closeModal} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"><Trash2 size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unit ID (Required)</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="text" required value={formData.unitId} onChange={e => setFormData({ ...formData, unitId: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                                    <div className="relative">
                                        <Activity className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                                            <option value="active">Active</option>
                                            <option value="maintenance">Maintenance</option>
                                            <option value="retired">Retired</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motherboard</label>
                                    <div className="relative">
                                        <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="text" value={formData.mobo} onChange={e => setFormData({ ...formData, mobo: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CPU</label>
                                    <div className="relative">
                                        <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="text" value={formData.cpu} onChange={e => setFormData({ ...formData, cpu: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">RAM</label>
                                    <div className="relative">
                                        <Database className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="text" value={formData.ram} onChange={e => setFormData({ ...formData, ram: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">GPU</label>
                                    <div className="relative">
                                        <View className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="text" value={formData.gpu} onChange={e => setFormData({ ...formData, gpu: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Storage</label>
                                    <div className="relative">
                                        <HardDrive className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="text" value={formData.storage} onChange={e => setFormData({ ...formData, storage: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">PSU</label>
                                    <div className="relative">
                                        <Zap className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="text" value={formData.psu} onChange={e => setFormData({ ...formData, psu: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monitor</label>
                                    <div className="relative">
                                        <MonitorIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="text" value={formData.monitor} onChange={e => setFormData({ ...formData, monitor: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assigned User</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <select value={formData.assignedToId} onChange={e => setFormData({ ...formData, assignedToId: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                                            <option value="">-- Unassigned --</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
                                <button type="button" onClick={closeModal} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">Cancel</button>
                                <button type="submit" className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm">Save Workstation</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ITTWorkstations;
