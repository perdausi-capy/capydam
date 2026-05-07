import React, { useState, useEffect, useMemo } from 'react';
import client from '../api/client';
import { toast } from 'react-toastify';
import { 
    Plus, Edit2, Trash2, Clock, 
    Zap, Activity, FileText, ArrowRight, Search, 
    PenTool, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../components/ConfirmModal';

interface User { id: string; name: string; avatar?: string; }
interface Report {
    id: string;
    date: string;
    hours: number;
    reactiveTickets: string[];
    proactiveMaintenance: string[];
    researchNotes?: string;
    nextSteps?: string;
    author: User;
    createdAt: string;
}

const DynamicBulletList = ({ label, items, onChange }: { label: string, items: string[], onChange: (v: string[]) => void }) => {
    const [input, setInput] = useState('');
    return (
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{label}</label>
            <div className="space-y-2">
                {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-black/20 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 group">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                        <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{item}</span>
                        <button type="button" onClick={() => onChange(items.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                    </div>
                ))}
                <div className="flex gap-2 mt-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (input.trim()) { onChange([...items, input.trim()]); setInput(''); } } }}
                        placeholder="Type task and press Enter..."
                        className="flex-1 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm placeholder:text-gray-400"
                    />
                    <button type="button" onClick={() => { if (input.trim()) { onChange([...items, input.trim()]); setInput(''); } }} className="px-4 py-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/30 font-bold transition-colors text-sm shadow-sm">
                        Add
                    </button>
                </div>
            </div>
        </div>
    );
};



const ReportDetailModal = ({ report, onClose }: { report: Report | null; onClose: () => void }) => {
    if (!report) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-[#1A1D21] rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-white/10"
            >
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-black/20">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white"><FileText size={20} /></div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Daily Shift Details</h2>
                            <p className="text-xs text-gray-500">{new Date(report.date).toLocaleDateString()} • {report.author.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <section>
                            <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> Reactive Support
                            </h4>
                            <ul className="space-y-2">
                                {report.reactiveTickets.map((t, i) => (
                                    <li key={i} className="text-sm bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5">{t}</li>
                                ))}
                                {report.reactiveTickets.length === 0 && <li className="text-sm text-gray-400 italic">No tickets recorded</li>}
                            </ul>
                        </section>

                        <section>
                            <h4 className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Proactive Maintenance
                            </h4>
                            <ul className="space-y-2">
                                {report.proactiveMaintenance.map((t, i) => (
                                    <li key={i} className="text-sm bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5">{t}</li>
                                ))}
                                {report.proactiveMaintenance.length === 0 && <li className="text-sm text-gray-400 italic">No maintenance performed</li>}
                            </ul>
                        </section>
                    </div>

                    <div className="grid grid-cols-1 gap-4 pt-6 border-t border-gray-100 dark:border-white/5">
                        {report.researchNotes && (
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Focus & Notes</span>
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-blue-50/50 dark:bg-blue-500/5 p-4 rounded-2xl">{report.researchNotes}</p>
                            </div>
                        )}
                        {report.nextSteps && (
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Next Steps</span>
                                <div className="bg-purple-50/50 dark:bg-purple-500/5 p-4 rounded-2xl">
                                    <ul className="space-y-2">
                                        {report.nextSteps.split('\n').filter(Boolean).map((step, i) => (
                                            <li key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed flex items-start gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                                                <span>{step}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

const ITTReports = () => {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewingReport, setViewingReport] = useState<Report | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        hours: 8,
        reactiveTickets: [] as string[],
        proactiveMaintenance: [] as string[],
        researchNotes: '',
        nextSteps: [] as string[]
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

    // Filtered results memoization for performance
    const filteredReports = useMemo(() => 
        reports.filter(r => 
            r.author.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.researchNotes && r.researchNotes.toLowerCase().includes(searchTerm.toLowerCase()))
        ),
        [reports, searchTerm]
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                nextSteps: formData.nextSteps.join('\n')
            };
            if (editingId) {
                await client.put(`/itt/reports/${editingId}`, payload);
                toast.success('Report updated');
            } else {
                await client.post('/itt/reports', payload);
                toast.success('Report submitted');
            }
            setIsModalOpen(false);
            fetchReports();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Operation failed');
        }
    };

    const executeDelete = async () => {
        if (!deleteId) return;
        
        try {
            await client.delete(`/itt/reports/${deleteId}`);
            toast.success('Report deleted');
            fetchReports();
        } catch {
            toast.error('Failed to delete report');
        } finally {
            setDeleteId(null);
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
                nextSteps: report.nextSteps ? report.nextSteps.split('\n').filter(Boolean) : []
            });
        } else {
            setEditingId(null);
            setFormData({
                date: new Date().toISOString().split('T')[0],
                hours: 8, reactiveTickets: [], proactiveMaintenance: [], researchNotes: '', nextSteps: []
            });
        }
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search technician reports..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#121418] border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-4">
                    <h2 className="hidden md:block text-xl font-bold px-2 text-gray-900 dark:text-white">Daily Activity Reports</h2>
                    <button onClick={() => openModal()} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm active:scale-95 whitespace-nowrap">
                        <Plus size={18} /> New Report
                    </button>
                </div>
            </div>

            {/* Listed Style Table Container */}
            <div className="bg-white dark:bg-[#121418] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 dark:bg-black/20 border-b border-gray-200 dark:border-white/10 text-[10px] uppercase font-bold text-gray-500 tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Technician</th>
                                <th className="px-6 py-4">Shift Date</th>
                                <th className="px-6 py-4 text-center">Reactive</th>
                                <th className="px-6 py-4 text-center">Proactive</th>
                                <th className="px-6 py-4">Logged Time</th>
                                <th className="px-6 py-4 w-1/4">Notes Preview</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {loading ? (
                                <tr><td colSpan={7} className="p-12 text-center text-gray-400">Syncing with server...</td></tr>
                            ) : filteredReports.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <PenTool size={40} className="text-gray-300 dark:text-gray-600" />
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Reports Found</h3>
                                            <p className="text-gray-500 text-xs">Try adjusting your search filters or log a new shift.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredReports.map(report => (
                                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                        {/* Technician Info */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden">
                                                    {report.author.avatar ? <img src={report.author.avatar} className="h-full w-full object-cover" /> : <span>{report.author.name.charAt(0)}</span>}
                                                </div>
                                                <span className="font-bold text-gray-900 dark:text-white">{report.author.name}</span>
                                            </div>
                                        </td>

                                        {/* Shift Date */}
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-medium font-mono text-xs">
                                            {new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>

                                        {/* Task Counts */}
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter">
                                                <Zap size={10} /> {report.reactiveTickets.length} Tasks
                                            </span>
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter">
                                                <Activity size={10} /> {report.proactiveMaintenance.length} Tasks
                                            </span>
                                        </td>

                                        {/* Logged Hours */}
                                        <td className="px-6 py-4">
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-black">
                                                <Clock size={12} /> {report.hours} HRS
                                            </div>
                                        </td>

                                        {/* Research Notes Preview */}
                                        <td className="px-6 py-4">
                                            <p className="text-gray-500 dark:text-gray-400 truncate max-w-xs text-xs italic">
                                                {report.researchNotes || "No notes provided"}
                                            </p>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openModal(report)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-white/5 rounded-lg transition-colors"><Edit2 size={14} /></button>
                                                <button 
                                                    onClick={() => setDeleteId(report.id)} 
                                                    className="p-1.5 text-gray-400 hover:text-red-500 bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-lg"
                                                    title="Delete Report"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                                <button onClick={() => setViewingReport(report)} className="p-1.5 text-blue-600 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 rounded-lg transition-all"><ArrowRight size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1A1D21] rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-white/10 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingId ? 'Edit Report' : 'Daily Shift Report'}
                            </h2>
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
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

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <DynamicBulletList
                                        label="Reactive Tickets (Fixes)"
                                        items={formData.reactiveTickets}
                                        onChange={items => setFormData({ ...formData, reactiveTickets: items })}
                                    />
                                    <DynamicBulletList
                                        label="Proactive Maintenance"
                                        items={formData.proactiveMaintenance}
                                        onChange={items => setFormData({ ...formData, proactiveMaintenance: items })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Shift Notes / Research</label>
                                    <textarea rows={3} value={formData.researchNotes} onChange={e => setFormData({ ...formData, researchNotes: e.target.value })} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-400" placeholder="Summarize focus areas..."></textarea>
                                </div>

                                <div>
                                    <DynamicBulletList
                                        label="Handoff / Next Steps"
                                        items={formData.nextSteps}
                                        onChange={items => setFormData({ ...formData, nextSteps: items })}
                                    />
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 dark:border-white/5 flex justify-end shrink-0 bg-gray-50/50 dark:bg-black/20">
                                <button type="submit" className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm">Submit Report</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            <AnimatePresence>
                {viewingReport && (
                    <ReportDetailModal
                        report={viewingReport}
                        onClose={() => setViewingReport(null)}
                    />
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <ConfirmModal 
                isOpen={!!deleteId} 
                onClose={() => setDeleteId(null)} 
                onConfirm={executeDelete} 
                title="Delete Daily Report" 
                message="Are you sure you want to delete this daily report? This action cannot be undone." 
                confirmText="Delete" 
                isDangerous={true} 
            />
        </div>
    );
};

export default ITTReports;
