import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, Monitor as MonitorIcon, Search } from 'lucide-react';

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
    const [searchTerm, setSearchTerm] = useState('');

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
                toast.success('Ledger entry updated');
            } else {
                await client.post('/itt/ledgers', formData);
                toast.success('New ledger entry created');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this ledger record? This action cannot be undone.')) return;
        try {
            await client.delete(`/itt/ledgers/${id}`);
            toast.success('Ledger record struck from log');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete record');
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

    // Filter ledgers based on search
    const filteredLedgers = ledgers.filter(log => 
        log.workstation?.unitId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.issue.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.assignedTech?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            
            {/* ACTION BAR */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-[#121418] p-4 rounded-xl border border-gray-300 dark:border-gray-700 shadow-sm">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search ledger entries..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#1A1D21] border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white font-mono"
                    />
                </div>
                <button onClick={() => openModal()} className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white text-white dark:text-gray-900 font-bold rounded-lg transition-colors shadow-sm uppercase tracking-wider text-xs">
                    <Plus size={16} strokeWidth={3} /> Append Entry
                </button>
            </div>

            {/* LEDGER TABLE (Authentic Spreadsheet/Ledger Style) */}
            <div className="overflow-x-auto bg-white dark:bg-[#121418] border-2 border-gray-800 dark:border-gray-500 rounded-lg shadow-md">
                {loading ? (
                    <div className="p-8 text-center text-gray-500 font-mono animate-pulse">Loading Ledger Volumes...</div>
                ) : filteredLedgers.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 font-mono">No records match your criteria.</div>
                ) : (
                    <table className="w-full text-left text-sm border-collapse font-sans">
                        <thead className="bg-gray-200 dark:bg-[#1A1D21] border-b-2 border-gray-800 dark:border-gray-500 text-xs uppercase font-black text-gray-800 dark:text-gray-300 tracking-widest">
                            <tr>
                                <th className="px-4 py-3 border-r border-gray-300 dark:border-gray-600 w-32">Date Logged</th>
                                <th className="px-4 py-3 border-r border-gray-300 dark:border-gray-600 w-40">Unit ID</th>
                                <th className="px-4 py-3 border-r border-gray-300 dark:border-gray-600">Issue Description</th>
                                <th className="px-4 py-3 border-r border-gray-300 dark:border-gray-600">Resolution / Action</th>
                                <th className="px-4 py-3 border-r border-gray-300 dark:border-gray-600 w-32">Status</th>
                                <th className="px-4 py-3 border-r border-gray-300 dark:border-gray-600 w-40">Technician</th>
                                <th className="px-4 py-3 text-center w-24">Cmds</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLedgers.map((log) => (
                                <tr 
                                    key={log.id} 
                                    className="group border-b border-gray-300 dark:border-gray-700 even:bg-blue-50/40 dark:even:bg-blue-900/10 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                                >
                                    {/* Date */}
                                    <td className="px-4 py-3 border-r border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-mono text-xs whitespace-nowrap">
                                        {new Date(log.createdAt).toISOString().split('T')[0]}
                                    </td>
                                    
                                    {/* Unit ID */}
                                    <td className="px-4 py-3 border-r border-gray-300 dark:border-gray-700 font-bold text-gray-900 dark:text-white font-mono flex items-center gap-2 h-full">
                                        <MonitorIcon size={14} className="text-gray-400" /> {log.workstation?.unitId || 'N/A'}
                                    </td>
                                    
                                    {/* Issue */}
                                    <td className="px-4 py-3 border-r border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                                        {log.issue}
                                    </td>
                                    
                                    {/* Action Taken */}
                                    <td className="px-4 py-3 border-r border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs italic">
                                        {log.actionTaken || '-- Pending --'}
                                    </td>
                                    
                                    {/* Status */}
                                    <td className="px-4 py-3 border-r border-gray-300 dark:border-gray-700 align-middle">
                                        <div className={`inline-flex items-center justify-center text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded border ${
                                            log.status === 'resolved' ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                                            log.status === 'in-progress' ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' :
                                            'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                                        }`}>
                                            {log.status}
                                        </div>
                                    </td>
                                    
                                    {/* Tech */}
                                    <td className="px-4 py-3 border-r border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs font-bold uppercase tracking-wide">
                                        {log.assignedTech?.name || 'UNASSIGNED'}
                                    </td>
                                    
                                    {/* Actions */}
                                    <td className="px-4 py-3 text-center align-middle">
                                        <div className="flex gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openModal(log)} className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-500 hover:text-blue-600 hover:border-blue-400 rounded shadow-sm transition-colors" title="Edit Entry"><Edit2 size={14} /></button>
                                            <button onClick={() => handleDelete(log.id)} className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-500 hover:text-red-600 hover:border-red-400 rounded shadow-sm transition-colors" title="Strike Record"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* FORM MODAL (Kept consistent with your Glassmorphism UI) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-200 dark:border-white/10">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-black/20">
                            <h2 className="text-lg font-black uppercase tracking-widest text-gray-900 dark:text-white">
                                {editingId ? 'Amend Ledger Entry' : 'New Ledger Entry'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">Close</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target Workstation</label>
                                    <select required value={formData.workstationId} onChange={e => setFormData({ ...formData, workstationId: e.target.value })} className="select-glass">
                                        <option value="">-- Select Unit ID --</option>
                                        {workstations.map(ws => (
                                            <option key={ws.id} value={ws.id}>{ws.unitId}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Status</label>
                                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="select-glass">
                                        <option value="open">Open / Unresolved</option>
                                        <option value="in-progress">In Progress</option>
                                        <option value="resolved">Resolved</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Issue Description</label>
                                <textarea required rows={3} value={formData.issue} onChange={e => setFormData({ ...formData, issue: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-400 text-sm font-medium" placeholder="Describe the hardware/software issue..."></textarea>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Action Taken (Resolution)</label>
                                <textarea rows={3} value={formData.actionTaken} onChange={e => setFormData({ ...formData, actionTaken: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-400 text-sm font-medium" placeholder="What steps were taken to resolve this?"></textarea>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-white/5 gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-lg font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-sm">Cancel</button>
                                <button type="submit" className="px-5 py-2.5 rounded-lg font-bold text-white bg-gray-900 dark:bg-blue-600 hover:bg-gray-800 dark:hover:bg-blue-500 transition-colors shadow-md text-sm">Save to Ledger</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ITTLedger;
