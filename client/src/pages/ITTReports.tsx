import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, Calendar, Clock, PenTool } from 'lucide-react';

interface User { id: string; name: string; avatar?: string; }
interface Report {
    id: string;
    date: string;
    hours: number;
    reactiveTickets: number;
    proactiveMaintenance: number;
    researchNotes?: string;
    nextSteps?: string;
    author: User;
    createdAt: string;
}

const ITTReports = () => {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        hours: 8,
        reactiveTickets: 0,
        proactiveMaintenance: 0,
        researchNotes: '',
        nextSteps: ''
    });

    const fetchReports = async () => {
        try {
            const { data } = await client.get('/itt/reports');
            setReports(data);
        } catch (error) {
            toast.error('Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReports(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await client.put(`/itt/reports/${editingId}`, formData);
                toast.success('Report updated');
            } else {
                await client.post('/itt/reports', formData);
                toast.success('Report submitted');
            }
            setIsModalOpen(false);
            fetchReports();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this report?')) return;
        try {
            await client.delete(`/itt/reports/${id}`);
            toast.success('Report deleted');
            fetchReports();
        } catch {
            toast.error('Failed to delete report');
        }
    };

    const openModal = (report?: Report) => {
        if (report) {
            setEditingId(report.id);
            setFormData({
                date: new Date(report.date).toISOString().split('T')[0],
                hours: report.hours,
                reactiveTickets: report.reactiveTickets,
                proactiveMaintenance: report.proactiveMaintenance,
                researchNotes: report.researchNotes || '',
                nextSteps: report.nextSteps || ''
            });
        } else {
            setEditingId(null);
            setFormData({
                date: new Date().toISOString().split('T')[0],
                hours: 8, reactiveTickets: 0, proactiveMaintenance: 0, researchNotes: '', nextSteps: ''
            });
        }
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-[#121418] p-4 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                <h2 className="text-xl font-bold px-2">Daily Activity Reports</h2>
                <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm">
                    <Plus size={18} /> New Report
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full text-center py-12 text-gray-500">Loading...</div>
                ) : reports.length === 0 ? (
                    <div className="col-span-full text-center py-20 bg-white/50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-300 dark:border-white/10">
                        <PenTool size={40} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Reports Found</h3>
                        <p className="text-gray-500">Log your first daily tech shift.</p>
                    </div>
                ) : (
                    reports.map((report) => (
                        <div key={report.id} className="bg-white dark:bg-[#121418] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                                        {report.author.avatar ? (
                                            <img src={report.author.avatar} alt="avatar" className="h-full w-full object-cover" />
                                        ) : (
                                            <span>{report.author.name.charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">{report.author.name}</h3>
                                        <div className="flex items-center gap-1 text-[11px] text-gray-500">
                                            <Calendar size={12} /> {new Date(report.date).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                {/* Only allow edit/delete if user is the author or explicitly an admin. Note, this route is admin-only via middleware anyway. */}
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openModal(report)} className="p-1.5 text-gray-400 hover:text-blue-500 bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-lg"><Edit2 size={14} /></button>
                                    <button onClick={() => handleDelete(report.id)} className="p-1.5 text-gray-400 hover:text-red-500 bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-lg"><Trash2 size={14} /></button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-gray-50 dark:bg-black/20 p-3 rounded-xl">
                                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Reactive Tasks</div>
                                    <div className="text-xl font-bold text-gray-900 dark:text-white">{report.reactiveTickets}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-black/20 p-3 rounded-xl">
                                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Proactive Tasks</div>
                                    <div className="text-xl font-bold text-gray-900 dark:text-white">{report.proactiveMaintenance}</div>
                                </div>
                            </div>

                            {(report.researchNotes || report.nextSteps) && (
                                <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-white/5 text-sm">
                                    {report.researchNotes && (
                                        <div>
                                            <span className="font-bold text-gray-900 dark:text-white block mb-0.5">Focus/Notes:</span>
                                            <p className="text-gray-600 dark:text-gray-400">{report.researchNotes}</p>
                                        </div>
                                    )}
                                    {report.nextSteps && (
                                        <div>
                                            <span className="font-bold text-gray-900 dark:text-white block mb-0.5">Next Steps:</span>
                                            <p className="text-gray-600 dark:text-gray-400">{report.nextSteps}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-4 flex items-center gap-1 text-[11px] text-gray-400">
                                <Clock size={12} /> Logged {report.hours} hours
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1A1D21] rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-gray-200 dark:border-white/10">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingId ? 'Edit Report' : 'Daily Shift Report'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500">Close</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                    <input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hours Logged</label>
                                    <input type="number" step="0.5" required value={formData.hours} onChange={e => setFormData({ ...formData, hours: parseFloat(e.target.value) })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reactive Tickets</label>
                                    <input type="number" min="0" required value={formData.reactiveTickets} onChange={e => setFormData({ ...formData, reactiveTickets: parseInt(e.target.value) })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Proactive Tasks</label>
                                    <input type="number" min="0" required value={formData.proactiveMaintenance} onChange={e => setFormData({ ...formData, proactiveMaintenance: parseInt(e.target.value) })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Shift Notes / Research</label>
                                <textarea rows={3} value={formData.researchNotes} onChange={e => setFormData({ ...formData, researchNotes: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-400" placeholder="Summarize focus areas..."></textarea>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Handoff / Next Steps</label>
                                <textarea rows={2} value={formData.nextSteps} onChange={e => setFormData({ ...formData, nextSteps: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-400" placeholder="For the next shift..."></textarea>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-white/5">
                                <button type="submit" className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm">Submit Report</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ITTReports;
