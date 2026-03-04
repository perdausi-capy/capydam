import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, Monitor as MonitorIcon } from 'lucide-react';

interface Workstation { id: string; unitId: string; }
interface User { id: string; name: string; }

interface Ledger {
    id: string;
    workstation: Workstation;
    issue: string;
    actionTaken: string;
    status: string;
    assignedTech?: User;
    createdAt: string;
}

const ITTLedger = () => {
    const [ledgers, setLedgers] = useState<Ledger[]>([]);
    const [workstations, setWorkstations] = useState<Workstation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        workstationId: '', issue: '', actionTaken: '', status: 'open'
    });

    const fetchData = async () => {
        try {
            const [ledgersRes, wsRes] = await Promise.all([
                client.get('/itt/ledgers'),
                client.get('/itt/workstations')
            ]);
            setLedgers(ledgersRes.data);
            setWorkstations(wsRes.data);
        } catch (error) {
            toast.error('Failed to load ledger data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.workstationId || !formData.issue) {
            toast.warning("Workstation and Issue are required");
            return;
        }

        try {
            if (editingId) {
                await client.put(`/itt/ledgers/${editingId}`, formData);
                toast.success('Log updated');
            } else {
                await client.post('/itt/ledgers', formData);
                toast.success('Log created');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this maintenance log?')) return;
        try {
            await client.delete(`/itt/ledgers/${id}`);
            toast.success('Log deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete log');
        }
    };

    const openModal = (log?: Ledger) => {
        if (log) {
            setEditingId(log.id);
            setFormData({
                workstationId: log.workstation.id,
                issue: log.issue,
                actionTaken: log.actionTaken || '',
                status: log.status
            });
        } else {
            setEditingId(null);
            setFormData({ workstationId: '', issue: '', actionTaken: '', status: 'open' });
        }
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-[#121418] p-4 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                <h2 className="text-xl font-bold px-2">Maintenance History</h2>
                <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm">
                    <Plus size={18} /> New Log
                </button>
            </div>

            <div className="overflow-x-auto bg-white dark:bg-[#121418] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : ledgers.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No maintenance logs found.</div>
                ) : (
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 dark:bg-black/20 border-b border-gray-200 dark:border-white/10 text-xs uppercase font-bold text-gray-500">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Workstation</th>
                                <th className="px-6 py-4 w-1/3">Issue</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Tech</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {ledgers.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4 text-gray-500">{new Date(log.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <MonitorIcon size={14} className="text-gray-400" /> {log.workstation?.unitId}
                                    </td>
                                    <td className="px-6 py-4 truncate max-w-xs">{log.issue}</td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${log.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                            log.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                            {log.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{log.assignedTech?.name || 'Unknown'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openModal(log)} className="p-1.5 text-gray-400 hover:text-blue-500"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDelete(log.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1A1D21] rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-gray-200 dark:border-white/10">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingId ? 'Edit Log' : 'New Maintenance Log'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500">Close</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Workstation</label>
                                    <select required value={formData.workstationId} onChange={e => setFormData({ ...formData, workstationId: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                                        <option value="">-- Select Unit --</option>
                                        {workstations.map(ws => (
                                            <option key={ws.id} value={ws.id}>{ws.unitId}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                                        <option value="open">Open</option>
                                        <option value="in-progress">In Progress</option>
                                        <option value="resolved">Resolved</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Issue Description</label>
                                <textarea required rows={3} value={formData.issue} onChange={e => setFormData({ ...formData, issue: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-400" placeholder="Describe the problem..."></textarea>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Action Taken</label>
                                <textarea rows={3} value={formData.actionTaken} onChange={e => setFormData({ ...formData, actionTaken: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-400" placeholder="Resolution steps..."></textarea>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button type="submit" className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm">Save Log</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ITTLedger;
