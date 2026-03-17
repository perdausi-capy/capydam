import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { toast } from 'react-toastify';
import {
    Plus, Edit2, Trash2, Cpu, HardDrive, Monitor as MonitorIcon,
    Search, Hash, Activity, Layers, Database, View, Zap, User,
    Eye, X, MessageSquare, Send, Clock, CheckCircle, RefreshCw,
    AlertCircle, FileText, Loader2, Check, ChevronUp, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserInfo {
    id: string;
    name: string;
    email: string;
}

interface Monitor {
    id?: string;
    model: string;
    specs?: string;
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
    monitors: Monitor[];
    status: string;
    notes?: string;
    assignedTo?: UserInfo;
}

interface Ticket {
    id: string;
    subject: string;
    message: string;
    status: string;
    createdAt: string;
    adminReply?: string;
    repliedAt?: string;
    user?: { name: string; email: string; avatar?: string };
}

const TicketStatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        new: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
        resolved: 'bg-green-500/15 text-green-400 border border-green-500/30',
        read: 'bg-gray-500/15 text-gray-400 border border-gray-500/30',
    };
    const icons: Record<string, React.ReactNode> = {
        new: <AlertCircle size={10} />,
        resolved: <CheckCircle size={10} />,
        read: <Clock size={10} />,
    };
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${styles[status] ?? styles.read}`}>
            {icons[status] ?? null}
            {status}
        </span>
    );
};

const WorkstationSpecs = ({ 
    viewingWs, 
    localNotes, 
    setLocalNotes, 
    isSavingNotes, 
    handleSaveNotes 
}: { 
    viewingWs: Workstation,
    localNotes: string,
    setLocalNotes: (val: string) => void,
    isSavingNotes: boolean,
    handleSaveNotes: () => void
}) => {
    const [showFullSpecs, setShowFullSpecs] = useState(false);

    // Primary specs shown by default
    const primarySpecs = [
        { label: 'Processor', value: viewingWs.cpu, icon: <Cpu size={14} /> },
        { label: 'Memory (RAM)', value: viewingWs.ram, icon: <Database size={14} /> },
        { label: 'Storage', value: viewingWs.storage, icon: <HardDrive size={14} /> },
        { label: 'Graphics (GPU)', value: viewingWs.gpu, icon: <View size={14} /> },
    ];

    // Secondary specs revealed on "See More"
    const extendedSpecs = [
        { label: 'Motherboard', value: viewingWs.mobo, icon: <Layers size={14} /> },
        { label: 'Power Supply', value: viewingWs.psu, icon: <Zap size={14} /> },
    ];

    const monitorSpecs = viewingWs.monitors.map((m, i) => ({
        label: i === 0 ? 'Primary Monitor' : `Monitor ${i + 1}`,
        value: `${m.model}${m.specs ? ` (${m.specs})` : ''}`,
        icon: <MonitorIcon size={14} />
    }));

    return (
        <div className="w-72 shrink-0 border-r border-white/5 overflow-y-auto p-6 space-y-5 bg-black/10 custom-scrollbar">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Hardware Specs</h3>
            
            {/* Primary Grid */}
            <div className="space-y-5">
                {primarySpecs.map(({ label, value, icon }) => (
                    <div key={label}>
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5 mb-0.5">{icon}{label}</h4>
                        <p className="text-gray-900 dark:text-white font-medium text-sm">{value || "Not Specified"}</p>
                    </div>
                ))}
            </div>

            {/* Extended Section */}
            <AnimatePresence>
                {showFullSpecs && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-5 overflow-hidden pt-5 border-t border-white/5"
                    >
                        {extendedSpecs.map(({ label, value, icon }) => (
                            <div key={label}>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5 mb-0.5">{icon}{label}</h4>
                                <p className="text-gray-700 dark:text-gray-300 font-medium text-sm">{value || "N/A"}</p>
                            </div>
                        ))}
                        {monitorSpecs.length > 0 ? (
                            monitorSpecs.map(({ label, value, icon }, idx) => (
                                <div key={idx}>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5 mb-0.5">{icon}{label}</h4>
                                    <p className="text-gray-700 dark:text-gray-300 font-medium text-sm">{value}</p>
                                </div>
                            ))
                        ) : (
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5 mb-0.5"><MonitorIcon size={14} /> Monitor</h4>
                                <p className="text-gray-700 dark:text-gray-300 font-medium text-sm">No Monitor Assigned</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <button 
                onClick={() => setShowFullSpecs(!showFullSpecs)}
                className="w-full py-2 mt-2 text-[11px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 flex items-center justify-center gap-2 border border-blue-500/20 rounded-lg hover:bg-blue-500/5 transition-all"
            >
                {showFullSpecs ? (
                    <><ChevronUp size={14} /> Show Less</>
                ) : (
                    <><ChevronDown size={14} /> See More Specs</>
                )}
            </button>

            {/* Internal Notes */}
            <div className="pt-6 border-t border-white/5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <FileText size={12} /> Internal Notes
                    </h3>
                    {localNotes !== (viewingWs?.notes || '') && (
                        <button onClick={handleSaveNotes} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1">
                            {isSavingNotes ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Save
                        </button>
                    )}
                </div>
                <textarea
                    value={localNotes}
                    onChange={(e) => setLocalNotes(e.target.value)}
                    placeholder="Add private IT notes..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-gray-300 focus:ring-1 focus:ring-blue-500/50 outline-none resize-none h-32 custom-scrollbar placeholder:text-gray-600 shadow-inner hover:bg-white/[0.07] transition-all"
                />
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5 mb-2"><User size={14} /> Assigned To</h4>
                {viewingWs.assignedTo ? (
                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-lg">
                            {viewingWs.assignedTo.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-bold text-sm truncate">{viewingWs.assignedTo.name}</p>
                            <p className="text-gray-500 text-[10px] truncate">{viewingWs.assignedTo.email}</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-green-500 dark:text-green-400 font-bold text-xs px-2">Available</p>
                )}
            </div>
        </div>
    );
};

const ITTWorkstations = () => {
    const [workstations, setWorkstations] = useState<Workstation[]>([]);
    const [users, setUsers] = useState<UserInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingWs, setViewingWs] = useState<Workstation | null>(null);

    // Tickets state (for detail modal)
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
    const [replyText, setReplyText] = useState('');
    const [replying, setReplying] = useState(false);
    // userId → count of 'new' (unreplied) tickets
    const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
    
    // Notes state for detail modal
    const [localNotes, setLocalNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    const [formData, setFormData] = useState({
        unitId: '', mobo: '', cpu: '', ram: '', gpu: '', psu: '', storage: '', status: 'active', assignedToId: ''
    });

    const [monitorList, setMonitorList] = useState<{ model: string, specs: string }[]>([{ model: '', specs: '' }]);

    const addMonitorField = () => {
        setMonitorList([...monitorList, { model: '', specs: '' }]);
    };

    const removeMonitorField = (index: number) => {
        setMonitorList(monitorList.filter((_, i) => i !== index));
    };

    const fetchData = async () => {
        try {
            const [wsRes, usersRes, ticketsRes] = await Promise.all([
                client.get('/itt/workstations'),
                client.get('/users'),
                client.get('/itt/tickets'),
            ]);
            setWorkstations(wsRes.data);
            setUsers(usersRes.data.data || usersRes.data);
            // Build unread map: userId → count of 'new' status tickets
            const map: Record<string, number> = {};
            for (const t of ticketsRes.data as Ticket[] & { userId?: string }[]) {
                const tk = t as any;
                if (tk.status === 'new' && tk.userId) {
                    map[tk.userId] = (map[tk.userId] ?? 0) + 1;
                }
            }
            setUnreadMap(map);
        } catch {
            toast.error('Failed to load workstations data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (viewingWs) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        // Cleanup on unmount
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [viewingWs]);

    const fetchTickets = useCallback(async (userId: string) => {
        setTickets([]);
        setActiveTicket(null);
        try {
            const res = await client.get(`/itt/tickets/user/${userId}`);
            setTickets(res.data);
            if (res.data.length > 0) setActiveTicket(res.data[0]);
        } catch {
            toast.error('Failed to load support tickets');
        }
    }, []);

    const openDetail = (ws: Workstation) => {
        setViewingWs(ws);
        setReplyText('');
        if (ws.assignedTo?.id) {
            fetchTickets(ws.assignedTo.id);
            // Clear the red badge for this user once they open the panel
            setUnreadMap(prev => ({ ...prev, [ws.assignedTo!.id]: 0 }));
        } else {
            setTickets([]);
            setActiveTicket(null);
        }
        setLocalNotes(ws.notes || '');
    };

    const handleSaveNotes = async () => {
        if (!viewingWs) return;
        setIsSavingNotes(true);
        try {
            await client.put(`/itt/workstations/${viewingWs.id}`, {
                ...viewingWs,
                assignedToId: viewingWs.assignedTo?.id,
                notes: localNotes
            });
            toast.success("Notes saved");
            fetchData(); // Refresh main list
            // Update viewingWs with new notes to hide save button
            setViewingWs(prev => prev ? { ...prev, notes: localNotes } : null);
        } catch (e) {
            toast.error("Failed to save notes");
        } finally {
            setIsSavingNotes(false);
        }
    };

    const handleReply = async () => {
        if (!activeTicket || !replyText.trim()) return;
        setReplying(true);
        try {
            const res = await client.post(`/itt/tickets/${activeTicket.id}/reply`, { message: replyText.trim() });
            const updated: Ticket = res.data;
            setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
            setActiveTicket(prev => prev ? { ...prev, ...updated } : prev);
            setReplyText('');
            toast.success('Reply sent!');
        } catch {
            toast.error('Failed to send reply');
        } finally {
            setReplying(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.unitId) { toast.warning("Unit ID is required"); return; }
        try {
            const payload = { 
                ...formData, 
                assignedToId: formData.assignedToId || null,
                monitors: monitorList.filter(m => m.model.trim() !== '')
            };
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
        } catch {
            toast.error('Failed to delete workstation');
        }
    };

    const openModal = (ws?: Workstation) => {
        if (ws) {
            setEditingId(ws.id);
            setFormData({
                unitId: ws.unitId || '', mobo: ws.mobo || '', cpu: ws.cpu || '',
                ram: ws.ram || '', gpu: ws.gpu || '', psu: ws.psu || '',
                storage: ws.storage || '',
                status: ws.status || 'active', assignedToId: ws.assignedTo?.id || ''
            });
            setMonitorList(ws.monitors.length > 0 ? ws.monitors.map(m => ({ model: m.model, specs: m.specs || '' })) : [{ model: '', specs: '' }]);
        } else {
            setEditingId(null);
            setFormData({ unitId: '', mobo: '', cpu: '', ram: '', gpu: '', psu: '', storage: '', status: 'active', assignedToId: '' });
            setMonitorList([{ model: '', specs: '' }]);
        }
        setIsModalOpen(true);
    };

    const closeModal = () => { setIsModalOpen(false); setEditingId(null); };

    const assignedUserIds = React.useMemo(() => {
        return new Set(
            workstations
                .map(ws => ws.assignedTo?.id)
                .filter(Boolean)
        );
    }, [workstations]);

    const availableUsers = React.useMemo(() => {
        return users.filter(u => {
            const isCurrentlyAssignedToThisUnit = editingId && formData.assignedToId === u.id;
            return !assignedUserIds.has(u.id) || isCurrentlyAssignedToThisUnit;
        });
    }, [users, assignedUserIds, editingId, formData.assignedToId]);

    const filteredWorkstations = React.useMemo(() =>
        workstations.filter(ws =>
            ws.unitId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ws.assignedTo?.name.toLowerCase().includes(searchTerm.toLowerCase())
        ), [workstations, searchTerm]);

    const statusColors: Record<string, string> = {
        active: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
        maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
        retired: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    };

    const renderWorkstationsTable = React.useMemo(() => {
        const COL_HEADER = 'px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 select-none border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0f1114]';
        const CELL = 'px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200';
        const CELL_MUTED = 'px-3 py-2.5 text-sm text-gray-400 dark:text-gray-500 italic';

        if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
        if (filteredWorkstations.length === 0) return (
            <div className="text-center py-20 bg-white/50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-300 dark:border-white/10">
                <HardDrive size={40} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Workstations Found</h3>
                <p className="text-gray-500">Create your first hardware inventory entry.</p>
            </div>
        );

        return (
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm">
                <table className="w-full border-collapse text-sm table-fixed">
                    <thead>
                        <tr>
                            <th className={COL_HEADER}>Name</th>
                            <th className={COL_HEADER}>Computer Number</th>
                            <th className={COL_HEADER}>Motherboard</th>
                            <th className={COL_HEADER}>CPU</th>
                            <th className={COL_HEADER}>GPU</th>
                            <th className={COL_HEADER}>RAM</th>
                            <th className={COL_HEADER}>Storage</th>
                            <th className={COL_HEADER}>Monitor</th>
                            <th className={COL_HEADER}>Status</th>
                            <th className={`${COL_HEADER} text-right`}>Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {filteredWorkstations.map((ws, idx) => (
                            <tr
                                key={ws.id}
                                className={`group transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-500/5 ${idx % 2 === 0 ? 'bg-white dark:bg-[#121418]' : 'bg-gray-50/60 dark:bg-[#0f1114]/60'}`}
                            >
                                {/* Name (assigned user) */}
                                <td className={CELL}>
                                    <div className="flex items-center gap-2">
                                        {ws.assignedTo ? (
                                            <>
                                                <div className="relative shrink-0">
                                                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                                                        {ws.assignedTo.name.charAt(0)}
                                                    </div>
                                                    {(unreadMap[ws.assignedTo.id] ?? 0) > 0 && (
                                                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full shadow animate-pulse ring-1 ring-white dark:ring-[#121418]">
                                                            {unreadMap[ws.assignedTo.id]}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-medium truncate max-w-[120px]">{ws.assignedTo.name}</span>
                                            </>
                                        ) : (
                                            <span className="text-green-500 dark:text-green-400 font-bold text-xs">Available</span>
                                        )}
                                    </div>
                                </td>

                                {/* Computer Number (unitId) */}
                                <td className={CELL}>
                                    <span className="font-semibold text-gray-900 dark:text-white">{ws.unitId}</span>
                                </td>


                                {/* Hardware columns */}
                                <td className={ws.mobo ? CELL : CELL_MUTED}>{ws.mobo || '—'}</td>

                                <td className={ws.cpu ? CELL : CELL_MUTED}>
                                    {ws.cpu ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-md">
                                            {ws.cpu}
                                        </span>
                                    ) : '—'}
                                </td>

                                <td className={ws.gpu ? CELL : CELL_MUTED}>{ws.gpu || '—'}</td>
                                <td className={ws.ram ? CELL : CELL_MUTED}>{ws.ram || '—'}</td>
                                <td className={ws.storage ? CELL : CELL_MUTED}>{ws.storage || '—'}</td>
                                <td className={ws.monitors.length > 0 ? CELL : CELL_MUTED}>
                                    {ws.monitors.length > 0 ? (
                                        <div className="flex flex-col gap-0.5">
                                            {ws.monitors.map((m, i) => (
                                                <span key={i} className="truncate max-w-[100px]" title={m.model}>
                                                    {m.model}
                                                </span>
                                            ))}
                                        </div>
                                    ) : 'No Monitor'}
                                </td>

                                {/* Status */}
                                <td className="px-3 py-2.5">
                                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[ws.status] ?? statusColors.retired}`}>
                                        {ws.status}
                                    </span>
                                </td>

                                {/* Actions */}
                                <td className="px-3 py-2.5">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openDetail(ws)} className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-white/5 rounded-lg transition-colors" title="View Details & Tickets"><Eye size={15} /></button>
                                        <button onClick={() => openModal(ws)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-white/5 rounded-lg transition-colors" title="Edit"><Edit2 size={15} /></button>
                                        <button onClick={() => handleDelete(ws.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-white/5 rounded-lg transition-colors" title="Delete"><Trash2 size={15} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Footer row count */}
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#0f1114] text-xs text-gray-400 flex items-center gap-1">
                    <Hash size={11} />
                    {filteredWorkstations.length} workstation{filteredWorkstations.length !== 1 ? 's' : ''}
                </div>
            </div>
        );
    }, [filteredWorkstations, loading, unreadMap]);

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
                <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm">
                    <Plus size={18} /> Add Workstation
                </button>
            </div>

            {renderWorkstationsTable}

            {/* ── Form Modal ── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1A1D21] rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-white/10">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Workstation' : 'Add Workstation'}</h2>
                            <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                {[
                                    { label: 'Unit ID (Required)', key: 'unitId', icon: <Hash size={16} />, required: true },
                                    { label: 'Motherboard', key: 'mobo', icon: <Layers size={16} /> },
                                    { label: 'CPU', key: 'cpu', icon: <Cpu size={16} /> },
                                    { label: 'RAM', key: 'ram', icon: <Database size={16} /> },
                                    { label: 'GPU', key: 'gpu', icon: <View size={16} /> },
                                    { label: 'Storage', key: 'storage', icon: <HardDrive size={16} /> },
                                    { label: 'PSU', key: 'psu', icon: <Zap size={16} /> },
                                ].map(({ label, key, icon, required }) => (
                                    <div key={key}>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
                                            <input
                                                type="text"
                                                required={required}
                                                value={(formData as any)[key]}
                                                onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                ))}

                                {/* Dynamic Monitors Section */}
                                <div className="md:col-span-2 space-y-4 border-t border-gray-100 dark:border-white/5 pt-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                            <MonitorIcon size={14} /> Display Setup
                                        </label>
                                        <button 
                                            type="button" 
                                            onClick={addMonitorField}
                                            className="text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-1 hover:underline"
                                        >
                                            <Plus size={14} /> Add Monitor
                                        </button>
                                    </div>

                                    <AnimatePresence>
                                        {monitorList.map((mon, idx) => (
                                            <motion.div 
                                                key={idx}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                                className="flex gap-2 items-start"
                                            >
                                                <div className="flex-1 grid grid-cols-2 gap-2">
                                                    <input
                                                        placeholder="Monitor Model"
                                                        value={mon.model}
                                                        onChange={(e) => {
                                                            const newArr = [...monitorList];
                                                            newArr[idx].model = e.target.value;
                                                            setMonitorList(newArr);
                                                        }}
                                                        className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                                                    />
                                                    <input
                                                        placeholder="Specs (e.g., 4K, 144Hz)"
                                                        value={mon.specs}
                                                        onChange={(e) => {
                                                            const newArr = [...monitorList];
                                                            newArr[idx].specs = e.target.value;
                                                            setMonitorList(newArr);
                                                        }}
                                                        className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                                                    />
                                                </div>
                                                {monitorList.length > 1 && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeMonitorField(idx)}
                                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                                    <div className="relative">
                                        <Activity className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="select-glass select-glass-icon">
                                            <option value="active">Active</option>
                                            <option value="maintenance">Maintenance</option>
                                            <option value="retired">Retired</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assigned User</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <select value={formData.assignedToId} onChange={e => setFormData({ ...formData, assignedToId: e.target.value })} className="select-glass select-glass-icon">
                                            <option value="">-- Unassigned --</option>
                                            {availableUsers.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.name} ({u.email})
                                                </option>
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

            {/* ── Workstation Detail + Tickets Modal ── */}
            <AnimatePresence>
                {viewingWs && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden">
                        
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setViewingWs(null)}
                            className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm transition-all duration-500"
                        />

                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative bg-[#1A1D21] rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden border border-white/10 z-10"
                        >

                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-black/20 shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 shadow-inner">
                                        <MonitorIcon size={26} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight leading-none mb-1">{viewingWs.unitId}</h2>
                                        <span className={`text-[10px] uppercase tracking-widest font-black px-3 py-0.5 rounded-full inline-flex items-center gap-1.5 ${statusColors[viewingWs.status] ?? 'bg-gray-500/20 text-gray-400'}`}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                            {viewingWs.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => { setViewingWs(null); openModal(viewingWs); }} className="px-4 py-2 text-xs rounded-xl font-bold text-gray-200 border border-white/10 hover:bg-white/5 transition-all flex items-center gap-2">
                                        <Edit2 size={14} /> Edit Hardware
                                    </button>
                                    <button onClick={() => setViewingWs(null)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"><X size={24} /></button>
                                </div>
                            </div>

                            {/* 3-Column Body */}
                            <div className="flex flex-1 overflow-hidden">

                                {/* COLUMN 1: Hardware Specs, Notes & Assignment */}
                                <WorkstationSpecs 
                                    viewingWs={viewingWs}
                                    localNotes={localNotes}
                                    setLocalNotes={setLocalNotes}
                                    isSavingNotes={isSavingNotes}
                                    handleSaveNotes={handleSaveNotes}
                                />

                                {/* COLUMN 2: Support Tickets List */}
                                <div className="w-72 shrink-0 border-r border-white/5 flex flex-col bg-[#1A1D21] custom-scrollbar">
                                    <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#1A1D21]/80 backdrop-blur-md z-10">
                                        <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                                            <MessageSquare size={14} className="text-blue-500" /> Support Tickets
                                        </div>
                                        {viewingWs.assignedTo && (
                                            <button onClick={() => fetchTickets(viewingWs.assignedTo!.id)} className="text-gray-500 hover:text-blue-400 transition-colors">
                                                <RefreshCw size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        {tickets.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-3 opacity-30">
                                                <MessageSquare size={32} />
                                                <span className="text-xs font-bold uppercase tracking-widest">No Tickets Found</span>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-white/5">
                                                {tickets.map(t => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => { setActiveTicket(t); setReplyText(t.adminReply ?? ''); }}
                                                        className={`w-full text-left p-6 transition-all relative group ${activeTicket?.id === t.id ? 'bg-blue-600/10' : 'hover:bg-white/[0.02]'}`}
                                                    >
                                                        {activeTicket?.id === t.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}
                                                        <div className="text-xs font-bold text-gray-200 mb-1 group-hover:text-white transition-colors">{t.subject}</div>
                                                        <div className="mb-2"><TicketStatusBadge status={t.status} /></div>
                                                        <p className="text-[10px] text-gray-500 line-clamp-1">{t.message}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* COLUMN 3: Interaction Panel */}
                                <div className="flex-1 flex flex-col bg-black/20 overflow-hidden custom-scrollbar">
                                    {activeTicket ? (
                                        <>
                                            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                                                <div className="space-y-2">
                                                    <h3 className="text-xl font-black text-white">{activeTicket.subject}</h3>
                                                    <p className="text-xs text-gray-500">Submitted on {new Date(activeTicket.createdAt).toLocaleDateString()}</p>
                                                </div>
                                                
                                                <div className="bg-white/5 rounded-3xl p-6 border border-white/5 shadow-inner">
                                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"><User size={12}/> User Message</p>
                                                    <p className="text-sm text-gray-300 leading-relaxed">{activeTicket.message}</p>
                                                </div>

                                                {activeTicket.adminReply && (
                                                    <div className="bg-blue-500/5 rounded-3xl p-6 border border-blue-500/10">
                                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2"><CheckCircle size={12}/> System Resolution</p>
                                                        <p className="text-sm text-blue-100/80 leading-relaxed italic">"{activeTicket.adminReply}"</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-6 bg-black/40 border-t border-white/5">
                                                <div className="flex gap-3">
                                                    <textarea
                                                        rows={2}
                                                        value={replyText}
                                                        onChange={e => setReplyText(e.target.value)}
                                                        placeholder="Type resolution message..."
                                                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white resize-none focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-600"
                                                    />
                                                    <button 
                                                        onClick={handleReply} 
                                                        disabled={replying || !replyText.trim()}
                                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
                                                    >
                                                        {replying ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-20">
                                            <MonitorIcon size={64} className="mb-6" />
                                            <h3 className="text-2xl font-black uppercase tracking-tighter">System Console</h3>
                                            <p className="text-sm">Select a support ticket to interact with the unit.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ITTWorkstations;
