import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { toast } from 'react-toastify';
import {
    Plus, Edit2, Trash2, Cpu, HardDrive, Monitor as MonitorIcon,
    Search, Hash, Activity, Layers, Database, View, Zap, User,
    Eye, X, MessageSquare, Send, Clock, CheckCircle, RefreshCw,
    ChevronRight, AlertCircle
} from 'lucide-react';

interface UserInfo {
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
    const [ticketsLoading, setTicketsLoading] = useState(false);
    const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
    const [replyText, setReplyText] = useState('');
    const [replying, setReplying] = useState(false);
    // userId → count of 'new' (unreplied) tickets
    const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

    const [formData, setFormData] = useState({
        unitId: '', mobo: '', cpu: '', ram: '', gpu: '', psu: '', storage: '', monitor: '', status: 'active', assignedToId: ''
    });

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

    const fetchTickets = useCallback(async (userId: string) => {
        setTicketsLoading(true);
        setTickets([]);
        setActiveTicket(null);
        try {
            const res = await client.get(`/itt/tickets/user/${userId}`);
            setTickets(res.data);
            if (res.data.length > 0) setActiveTicket(res.data[0]);
        } catch {
            toast.error('Failed to load support tickets');
        } finally {
            setTicketsLoading(false);
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
                storage: ws.storage || '', monitor: ws.monitor || '',
                status: ws.status || 'active', assignedToId: ws.assignedTo?.id || ''
            });
        } else {
            setEditingId(null);
            setFormData({ unitId: '', mobo: '', cpu: '', ram: '', gpu: '', psu: '', storage: '', monitor: '', status: 'active', assignedToId: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => { setIsModalOpen(false); setEditingId(null); };

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

    const renderWorkstationsGrid = React.useMemo(() => {
        if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
        if (filteredWorkstations.length === 0) return (
            <div className="text-center py-20 bg-white/50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-300 dark:border-white/10">
                <HardDrive size={40} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Workstations Found</h3>
                <p className="text-gray-500">Create your first hardware inventory entry.</p>
            </div>
        );
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredWorkstations.map(ws => (
                    <div key={ws.id} className="bg-white dark:bg-[#121418] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                            <div className="relative p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                                <MonitorIcon size={22} />
                                {ws.assignedTo && (unreadMap[ws.assignedTo.id] ?? 0) > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse ring-2 ring-[#121418]">
                                        {unreadMap[ws.assignedTo.id]}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openDetail(ws)} className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-white/5 rounded" title="View Details & Tickets"><Eye size={16} /></button>
                                <button onClick={() => openModal(ws)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-white/5 rounded" title="Edit"><Edit2 size={16} /></button>
                                <button onClick={() => handleDelete(ws.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-white/5 rounded" title="Delete"><Trash2 size={16} /></button>
                            </div>
                        </div>
                        <div className="min-h-[3.75rem] mb-4">
                            <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight line-clamp-2 mb-1">{ws.unitId}</h3>
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full inline-block ${statusColors[ws.status] ?? statusColors.retired}`}>{ws.status}</span>
                        </div>
                        <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><Cpu size={14} className="text-gray-400 shrink-0" /> {ws.cpu || 'N/A'}</div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><HardDrive size={14} className="text-gray-400 shrink-0" /> {ws.ram} RAM • {ws.storage} Storage</div>
                        </div>
                        <div className="pt-4 mt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Assigned To:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{ws.assignedTo ? ws.assignedTo.name : 'Unassigned'}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }, [filteredWorkstations, loading]);

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

            {renderWorkstationsGrid}

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
                                    { label: 'Monitor', key: 'monitor', icon: <MonitorIcon size={16} /> },
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
                                            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
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
            {viewingWs && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 animate-in fade-in duration-200">
                    <div className="bg-[#1A1D21] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-white/10 relative">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
                                    <MonitorIcon size={22} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight">{viewingWs.unitId}</h2>
                                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full inline-block ${statusColors[viewingWs.status] ?? statusColors.retired}`}>
                                        {viewingWs.status}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => { setViewingWs(null); openModal(viewingWs); }} className="px-3 py-1.5 text-sm rounded-lg font-bold text-gray-200 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2">
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button onClick={() => setViewingWs(null)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"><X size={20} /></button>
                            </div>
                        </div>

                        {/* Two-column body */}
                        <div className="flex flex-1 overflow-hidden">

                            {/* LEFT — Hardware Specs */}
                            <div className="w-72 shrink-0 border-r border-white/5 overflow-y-auto p-6 space-y-5 bg-black/10">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Hardware Specs</h3>
                                {[
                                    { label: 'Processor', value: viewingWs.cpu, icon: <Cpu size={14} /> },
                                    { label: 'Motherboard', value: viewingWs.mobo, icon: <Layers size={14} /> },
                                    { label: 'Memory (RAM)', value: viewingWs.ram, icon: <Database size={14} /> },
                                    { label: 'Graphics (GPU)', value: viewingWs.gpu, icon: <View size={14} /> },
                                    { label: 'Storage', value: viewingWs.storage, icon: <HardDrive size={14} /> },
                                    { label: 'Power Supply', value: viewingWs.psu, icon: <Zap size={14} /> },
                                    { label: 'Monitor', value: viewingWs.monitor, icon: <MonitorIcon size={14} /> },
                                ].map(({ label, value, icon }) => (
                                    <div key={label}>
                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5 mb-0.5">{icon}{label}</h4>
                                        <p className="text-gray-900 dark:text-white font-medium text-sm">{value || <span className="text-gray-400 italic font-normal">Not Specified</span>}</p>
                                    </div>
                                ))}

                                <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5 mb-2"><User size={14} /> Assigned To</h4>
                                    {viewingWs.assignedTo ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-base shadow-sm shrink-0">
                                                {viewingWs.assignedTo.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-gray-900 dark:text-white font-semibold text-sm">{viewingWs.assignedTo.name}</p>
                                                <p className="text-gray-500 text-xs">{viewingWs.assignedTo.email}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-gray-400 italic text-sm">Unassigned</p>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT — Support Tickets Panel */}
                            <div className="flex-1 flex overflow-hidden">

                                {/* Ticket List */}
                                <div className="w-64 shrink-0 border-r border-gray-100 dark:border-white/5 overflow-y-auto flex flex-col bg-[#1A1D21]">
                                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#1A1D21] z-10">
                                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                                            <MessageSquare size={15} className="text-blue-500" />
                                            Support Tickets
                                            {tickets.length > 0 && (
                                                <span className="bg-blue-500/15 text-blue-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{tickets.length}</span>
                                            )}
                                        </div>
                                        {viewingWs.assignedTo && (
                                            <button onClick={() => fetchTickets(viewingWs.assignedTo!.id)} className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors" title="Refresh">
                                                <RefreshCw size={13} />
                                            </button>
                                        )}
                                    </div>

                                    {!viewingWs.assignedTo ? (
                                        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2">
                                            <User size={28} className="text-gray-300 dark:text-gray-600" />
                                            <p className="text-xs text-gray-400">No user assigned to this workstation.</p>
                                        </div>
                                    ) : ticketsLoading ? (
                                        <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">Loading...</div>
                                    ) : tickets.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2">
                                            <MessageSquare size={28} className="text-gray-300 dark:text-gray-600" />
                                            <p className="text-xs text-gray-400">No ITT support tickets from this user yet.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-white/5">
                                            {tickets.map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => { setActiveTicket(t); setReplyText(t.adminReply ?? ''); }}
                                                    className={`w-full text-left px-4 py-3 transition-colors group flex items-start gap-2 ${activeTicket?.id === t.id ? 'bg-blue-500/15' : 'hover:bg-white/5'}`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                            <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{t.subject}</span>
                                                        </div>
                                                        <p className="text-[11px] text-gray-500 line-clamp-1">{t.message}</p>
                                                        <div className="mt-1"><TicketStatusBadge status={t.status} /></div>
                                                    </div>
                                                    <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 shrink-0 mt-1 group-hover:text-blue-400 transition-colors" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Ticket Detail + Reply */}
                                <div className="flex-1 flex flex-col overflow-hidden bg-[#1A1D21]">
                                    {!activeTicket ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8">
                                            <MessageSquare size={40} className="text-gray-200 dark:text-gray-700" />
                                            <p className="text-sm text-gray-400 font-medium">Select a ticket to view and reply</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Ticket Header */}
                                            <div className="px-5 py-4 border-b border-white/5 shrink-0">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <h3 className="font-bold text-gray-900 dark:text-white text-base">{activeTicket.subject}</h3>
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            From <span className="font-medium text-gray-600 dark:text-gray-300">{activeTicket.user?.name ?? viewingWs.assignedTo?.name}</span>
                                                            {' · '}
                                                            {new Date(activeTicket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                    <TicketStatusBadge status={activeTicket.status} />
                                                </div>
                                            </div>

                                            {/* Scrollable content */}
                                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                                {/* User Message */}
                                                <div className="bg-white/5 rounded-xl p-4 border border-white/8">
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                        <User size={12} /> User Message
                                                    </p>
                                                    <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{activeTicket.message}</p>
                                                </div>

                                                {/* Existing reply */}
                                                {activeTicket.adminReply && (
                                                    <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                                                        <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                            <CheckCircle size={12} /> Your Reply
                                                            {activeTicket.repliedAt && (
                                                                <span className="font-normal text-blue-400 normal-case tracking-normal">
                                                                    · {new Date(activeTicket.repliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="text-sm text-blue-200 leading-relaxed whitespace-pre-wrap">{activeTicket.adminReply}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Reply Box */}
                                            <div className="px-5 py-4 border-t border-white/5 shrink-0 bg-black/20">
                                                <div className="flex gap-2 items-end">
                                                    <textarea
                                                        rows={2}
                                                        value={replyText}
                                                        onChange={e => setReplyText(e.target.value)}
                                                        placeholder={activeTicket.adminReply ? 'Update your reply...' : 'Write a reply...'}
                                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white resize-none focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-500"
                                                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply(); }}
                                                    />
                                                    <button
                                                        onClick={handleReply}
                                                        disabled={replying || !replyText.trim()}
                                                        className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors flex items-center gap-1.5 font-bold text-sm shrink-0"
                                                        title="Send (Ctrl+Enter)"
                                                    >
                                                        <Send size={15} />
                                                        {replying ? 'Sending...' : activeTicket.adminReply ? 'Update' : 'Send'}
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-1.5">Press <kbd className="bg-gray-100 dark:bg-white/10 px-1 rounded text-[10px]">Ctrl+Enter</kbd> to send</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ITTWorkstations;
