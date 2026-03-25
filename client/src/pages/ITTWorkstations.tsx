import React, { useState, useEffect, useCallback, useMemo } from 'react';
import client from '../api/client';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';
import {
    Plus, Edit2, Trash2, Cpu, HardDrive, Monitor as MonitorIcon,
    Search, Hash, Activity, Layers, Database, View, Zap, User,
    Eye, X, MessageSquare, Send, Clock, CheckCircle, RefreshCw,
    AlertCircle, FileText, Loader2, Check, ChevronUp, ChevronDown, ChevronRight,
    Settings, Package, Wrench, XCircle, UserMinus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../components/ConfirmModal';

interface InventoryItem {
    id: string; 
    itemName: string; 
    serialNumber: string; 
    type: string; 
    status: string;
    purchaseDate?: string | null;
    notes?: string | null;
}

interface UserInfo {
    id: string;
    name: string;
    email: string;
    avatar?: string;
}

interface Monitor {
    id?: string;
    model: string;
    specs?: string;
}

interface PartItem {
    id: string;
    itemName: string;
    serialNumber: string;
    type: string;
    status: string;
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
    monitor?: string;
    monitors: Monitor[];
    parts: PartItem[];
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

    // Use relational parts instead of static strings
    const parts = viewingWs.parts || [];
    
    // Sort into primary/extended simply for layout consistency
    const primaryTypes = ['CPU', 'RAM', 'STORAGE', 'GPU'];
    const primaryParts = parts.filter(p => primaryTypes.includes(p.type));
    const extendedParts = parts.filter(p => !primaryTypes.includes(p.type));

    const monitorSpecs = viewingWs.monitors.map((m, i) => ({
        label: i === 0 ? 'Primary Monitor' : `Monitor ${i + 1}`,
        value: `${m.model}${m.specs ? ` (${m.specs})` : ''}`,
        icon: <MonitorIcon size={14} />
    }));

    return (
        <div className="w-72 shrink-0 border-r border-white/5 overflow-y-auto p-6 space-y-5 bg-black/10 custom-scrollbar">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <View size={14} className="text-blue-500" /> 
                Relational Specs
            </h3>

            {/* Primary Grid */}
            <div className="space-y-5">
                {primaryParts.length > 0 ? primaryParts.map(part => (
                    <div key={part.id}>
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5 mb-0.5">
                            {part.type === 'CPU' ? <Cpu size={14} /> : 
                             part.type === 'RAM' ? <Database size={14} /> :
                             part.type === 'STORAGE' ? <HardDrive size={14} /> :
                             part.type === 'GPU' ? <View size={14} /> : <Package size={14} />}
                            {part.type}
                        </h4>
                        <p className="text-gray-900 dark:text-white font-medium text-sm">{part.itemName}</p>
                        <p className="text-[9px] text-gray-500 font-mono">SN: {part.serialNumber}</p>
                    </div>
                )) : (
                    <p className="text-xs italic text-gray-400">No primary hardware assigned.</p>
                )}
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
                        {extendedParts.map(part => (
                            <div key={part.id}>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5 mb-0.5">
                                    {part.type === 'MOBO' ? <Layers size={14} /> :
                                     part.type === 'PSU' ? <Zap size={14} /> : <Package size={14} />}
                                    {part.type}
                                </h4>
                                <p className="text-gray-700 dark:text-gray-300 font-medium text-sm">{part.itemName}</p>
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

const statusConfig = {
    active: { label: 'Active', icon: <CheckCircle size={14} />, color: 'text-green-500' },
    maintenance: { label: 'Maintenance', icon: <Wrench size={14} />, color: 'text-amber-500' },
    retired: { label: 'Retired', icon: <XCircle size={14} />, color: 'text-red-500' },
};

const ITTWorkstations = () => {
    const queryClient = useQueryClient(); // Added useQueryClient
    const [workstations, setWorkstations] = useState<Workstation[]>([]);
    const [users, setUsers] = useState<UserInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [stock, setStock] = useState<InventoryItem[]>([]);
    const [partsToDeploy, setPartsToDeploy] = useState<Set<string>>(new Set());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [initialHardware, setInitialHardware] = useState<Record<string, string>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [specFilters, setSpecFilters] = useState({
        cpu: '',
        ram: '',
        gpu: '',
        storage: ''
    });

    // Extract unique values for dynamic dropdowns
    const uniqueSpecs = useMemo(() => {
        return {
            cpus: [...new Set(workstations.map(ws => ws.cpu).filter(Boolean))],
            rams: [...new Set(workstations.map(ws => ws.ram).filter(Boolean))],
            gpus: [...new Set(workstations.map(ws => ws.gpu).filter(Boolean))],
            storages: [...new Set(workstations.map(ws => ws.storage).filter(Boolean))]
        };
    }, [workstations]);

    const resetFilters = () => {
        setSearchTerm('');
        setSpecFilters({ cpu: '', ram: '', gpu: '', storage: '' });
    };

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [viewingWs, setViewingWs] = useState<Workstation | null>(null);

    // Tickets state (for detail modal)
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
    const [replyText, setReplyText] = useState('');
    const [replying, setReplying] = useState(false);
    const [resolving, setResolving] = useState(false);
    // userId → count of 'new' (unreplied) tickets
    const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

    // Notes state for detail modal
    const [localNotes, setLocalNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    const [formData, setFormData] = useState({
        unitId: '', mobo: '', cpu: '', ram: '', gpu: '', psu: '', storage: '', monitor: '', status: 'active', assignedToId: ''
    });

    const selectedUser = users.find(u => u.id === formData.assignedToId);


    const fetchData = async () => {
        try {
            const [wsRes, usersRes, ticketsRes, invRes] = await Promise.all([
                client.get('/itt/workstations'),
                client.get('/users'),
                client.get('/itt/tickets'),
                client.get('/itt/inventory')
            ]);
            setWorkstations(wsRes.data);
            setUsers(usersRes.data.data || usersRes.data);
            setStock(invRes.data);
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

    const handleResolve = async () => {
        if (!activeTicket) return;
        setResolving(true);
        try {
            const res = await client.patch(`/itt/tickets/${activeTicket.id}/status`, { status: 'resolved' });
            const updated: Ticket = res.data;

            // Update local state to reflect the resolved status immediately
            setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, status: 'resolved' } : t));
            setActiveTicket(prev => prev ? { ...prev, status: 'resolved' } : prev);

            toast.success('Ticket marked as resolved!');
        } catch {
            toast.error('Failed to resolve ticket');
        } finally {
            setResolving(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.unitId) { toast.warning("Unit ID is required"); return; }
        try {
            // Build the list of inventory items to release (swapped out)
            const releasedItemIds: string[] = [];
            if (editingId) {
                const hardwareKeys = ['mobo', 'cpu', 'ram', 'gpu', 'psu', 'storage', 'monitor'];
                hardwareKeys.forEach(key => {
                    const oldVal = (initialHardware as any)[key];
                    const newVal = (formData as any)[key];
                    if (oldVal !== newVal && oldVal) {
                        const snMatch = oldVal.match(/\(SN:\s*(.+?)\)/);
                        if (snMatch?.[1]) {
                            const invItem = stock.find(i => i.serialNumber === snMatch[1].trim());
                            if (invItem) releasedItemIds.push(invItem.id);
                        }
                    }
                });
            }

            // Build payload — backend handles deploy/release atomically in one transaction
            const payload = {
                ...formData,
                assignedToId: formData.assignedToId || null,
                deployedItemIds: Array.from(partsToDeploy),
                releasedItemIds,
            };

            if (editingId) {
                await client.put(`/itt/workstations/${editingId}`, payload);
                toast.success('Workstation updated');
            } else {
                await client.post('/itt/workstations', payload);
                toast.success('Workstation created');
            }

            if (partsToDeploy.size > 0) {
                toast.info(`${partsToDeploy.size} inventory item(s) deployed`);
            }
            if (releasedItemIds.length > 0) {
                toast.info(`${releasedItemIds.length} old part(s) returned to stock`);
            }

            closeModal();
            fetchData();
            queryClient.invalidateQueries({ queryKey: ['workstations'] }); // Invalidate workstations query
            queryClient.invalidateQueries({ queryKey: ['inventory'] }); // Invalidate inventory query
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Operation failed');
        }
    };

    const executeDelete = async () => {
        if (!deleteId) return;

        try {
            await client.delete(`/itt/workstations/${deleteId}`);
            toast.success('Workstation deleted');
            fetchData();
            queryClient.invalidateQueries({ queryKey: ['workstations'] }); // Invalidate workstations query
            queryClient.invalidateQueries({ queryKey: ['inventory'] }); // Invalidate inventory query
        } catch {
            toast.error('Failed to delete workstation');
        } finally {
            setDeleteId(null);
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
            setInitialHardware({
                mobo: ws.mobo || '', cpu: ws.cpu || '', ram: ws.ram || '',
                gpu: ws.gpu || '', psu: ws.psu || '', storage: ws.storage || '', monitor: ws.monitor || ''
            });
        } else {
            setEditingId(null);
            setFormData({ unitId: '', mobo: '', cpu: '', ram: '', gpu: '', psu: '', storage: '', monitor: '', status: 'active', assignedToId: '' });
            setInitialHardware({});
        }
        setPartsToDeploy(new Set());
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setPartsToDeploy(new Set());
    };

    const assignedUserIds = useMemo(() => {
        return new Set(
            workstations
                .map(ws => ws.assignedTo?.id)
                .filter(Boolean)
        );
    }, [workstations]);

    const availableUsers = useMemo(() => {
        return users.filter(u => {
            const isCurrentlyAssignedToThisUnit = editingId && formData.assignedToId === u.id;
            return !assignedUserIds.has(u.id) || isCurrentlyAssignedToThisUnit;
        });
    }, [users, assignedUserIds, editingId, formData.assignedToId]);

    const filteredWorkstations = useMemo(() => {
        return workstations.filter(ws => {
            // 1. Text Search (Unit ID or Assignee)
            const matchesSearch =
                ws.unitId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ws.assignedTo?.name.toLowerCase().includes(searchTerm.toLowerCase());

            // 2. Hardware Spec Matching
            const matchesCpu = !specFilters.cpu || ws.cpu === specFilters.cpu;
            const matchesRam = !specFilters.ram || ws.ram === specFilters.ram;
            const matchesGpu = !specFilters.gpu || ws.gpu === specFilters.gpu;
            const matchesStorage = !specFilters.storage || ws.storage === specFilters.storage;

            return matchesSearch && matchesCpu && matchesRam && matchesGpu && matchesStorage;
        });
    }, [workstations, searchTerm, specFilters]);

    const statusColors: Record<string, string> = {
        active: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
        maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
        retired: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    };

    const renderWorkstationsTable = useMemo(() => {
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
                                <td className={(ws as any).monitor ? CELL : CELL_MUTED}>
                                    {(ws as any).monitor || 'No Monitor'}
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
                                        <button
                                            onClick={() => setDeleteId(ws.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                                            title="Delete Workstation"
                                        >
                                            <Trash2 size={15} />
                                        </button>
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

            {/* --- ADVANCED SPEC FILTERS --- */}
            <div className="flex flex-wrap gap-3 bg-white/40 dark:bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm mb-6">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mr-2">
                    <Settings size={14} /> Filters:
                </div>

                {/* CPU Filter */}
                <div className="flex-1 min-w-[140px]">
                    <select
                        value={specFilters.cpu}
                        onChange={e => setSpecFilters({ ...specFilters, cpu: e.target.value })}
                        className="select-glass"
                    >
                        <option value="">All CPUs</option>
                        {uniqueSpecs.cpus.map(cpu => <option key={cpu} value={cpu}>{cpu}</option>)}
                    </select>
                </div>

                {/* RAM Filter */}
                <div className="flex-1 min-w-[140px]">
                    <select
                        value={specFilters.ram}
                        onChange={e => setSpecFilters({ ...specFilters, ram: e.target.value })}
                        className="select-glass"
                    >
                        <option value="">All RAM</option>
                        {uniqueSpecs.rams.map(ram => <option key={ram} value={ram}>{ram}</option>)}
                    </select>
                </div>

                {/* GPU Filter */}
                <div className="flex-1 min-w-[140px]">
                    <select
                        value={specFilters.gpu}
                        onChange={e => setSpecFilters({ ...specFilters, gpu: e.target.value })}
                        className="select-glass"
                    >
                        <option value="">All GPUs</option>
                        {uniqueSpecs.gpus.map(gpu => <option key={gpu} value={gpu}>{gpu}</option>)}
                    </select>
                </div>

                {/* Storage Filter */}
                <div className="flex-1 min-w-[140px]">
                    <select
                        value={specFilters.storage}
                        onChange={e => setSpecFilters({ ...specFilters, storage: e.target.value })}
                        className="select-glass"
                    >
                        <option value="">All Storage</option>
                        {uniqueSpecs.storages.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                </div>

                {/* Reset Button */}
                <button
                    onClick={resetFilters}
                    className="px-4 py-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all flex items-center gap-2 text-sm font-bold"
                >
                    <RefreshCw size={14} /> Reset
                </button>
            </div>

            {renderWorkstationsTable}

            {/* ── Form Modal ── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1A1D21] rounded-2xl shadow-xl w-full max-w-2xl overflow-visible border border-gray-200 dark:border-white/10">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center rounded-t-2xl overflow-hidden">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Workstation' : 'Add Workstation'}</h2>
                            <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                {[
                                    { label: 'Unit ID (Required)', key: 'unitId', icon: <Hash size={16} />, required: true },
                                    { label: 'Motherboard', key: 'mobo', icon: <Layers size={16} />, invType: 'MOBO' },
                                    { label: 'CPU', key: 'cpu', icon: <Cpu size={16} />, invType: 'CPU' },
                                    { label: 'RAM', key: 'ram', icon: <Database size={16} />, invType: 'RAM' },
                                    { label: 'GPU', key: 'gpu', icon: <View size={16} />, invType: 'GPU' },
                                    { label: 'Storage', key: 'storage', icon: <HardDrive size={16} />, invType: 'STORAGE' },
                                    { label: 'PSU', key: 'psu', icon: <Zap size={16} />, invType: 'PSU' },
                                    { label: 'Monitor', key: 'monitor', icon: <MonitorIcon size={16} />, invType: 'MONITOR' },
                                ].map(({ label, key, icon, required, invType }) => {

                                    // Check if we have active stock for this specific hardware type
                                    const availableStock = invType ? stock.filter(s => s.type === invType && s.status === 'Active') : [];

                                    return (
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

                                        {/* Stock Picker Dropdown */}
                                        {availableStock.length > 0 && (
                                            <div className="relative mt-1.5">
                                                <Package className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" size={12} />
                                                <select
                                                    className="w-full bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 text-blue-700 dark:text-blue-400 text-[11px] rounded-md pl-7 pr-6 py-1.5 outline-none cursor-pointer appearance-none"
                                                    onChange={(e) => {
                                                        if (!e.target.value) return;
                                                        const item = availableStock.find(i => i.id === e.target.value);
                                                        if (item) {
                                                            // Populate the text field with Name + Serial Number
                                                            setFormData({ ...formData, [key]: `${item.itemName} (SN: ${item.serialNumber})` });
                                                            // Track this ID to update it to "Deployed" on save
                                                            setPartsToDeploy(prev => new Set(prev).add(item.id));
                                                        }
                                                    }}
                                                >
                                                    <option value="">Assign from local inventory...</option>
                                                    {availableStock.map(item => (
                                                        <option key={item.id} value={item.id}>
                                                            {item.itemName} (SN: {item.serialNumber})
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                                                    <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )})}


                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                                    <div className="relative">
                                        {/* The Glassmorphic Trigger */}
                                        <button
                                            type="button"
                                            onClick={() => setIsStatusOpen(!isStatusOpen)}
                                            className="select-glass flex items-center justify-between w-full"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={statusConfig[formData.status as keyof typeof statusConfig]?.color}>
                                                    {statusConfig[formData.status as keyof typeof statusConfig]?.icon}
                                                </span>
                                                <span className="capitalize">{formData.status}</span>
                                            </div>
                                            <ChevronDown size={14} className={`transition-transform ${isStatusOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Custom Dropdown List */}
                                        <AnimatePresence>
                                            {isStatusOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-[60] backdrop-blur-xl"
                                                >
                                                    {Object.entries(statusConfig).map(([key, cfg]) => (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData({ ...formData, status: key });
                                                                setIsStatusOpen(false);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 last:border-0"
                                                        >
                                                            <span className={cfg.color}>{cfg.icon}</span>
                                                            <span className="text-gray-900 dark:text-white">{cfg.label}</span>
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assigned User</label>
                                    <div className="relative">
                                        {/* The Glassmorphic Trigger Button */}
                                        <button
                                            type="button"
                                            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                                            className="select-glass flex items-center justify-between w-full h-[42px]"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center overflow-hidden shrink-0 border border-gray-100 dark:border-white/10 text-gray-400">
                                                    {selectedUser?.avatar ? (
                                                        <img src={selectedUser.avatar} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User size={14} />
                                                    )}
                                                </div>
                                                <span className="text-sm truncate">
                                                    {selectedUser ? selectedUser.name : '-- Unassigned --'}
                                                </span>
                                            </div>
                                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Dropdown List */}
                                        <AnimatePresence>
                                            {isUserDropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[100] backdrop-blur-xl max-h-60 overflow-y-auto custom-scrollbar"
                                                >
                                                    {/* Unassigned Option */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData({ ...formData, assignedToId: '' });
                                                            setIsUserDropdownOpen(false);
                                                        }}
                                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5"
                                                    >
                                                        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400">
                                                            <UserMinus size={14} />
                                                        </div>
                                                        <span className="flex-1 text-left">-- Unassigned --</span>
                                                        {!formData.assignedToId && <Check size={14} className="text-blue-500" />}
                                                    </button>

                                                    {/* User List */}
                                                    {availableUsers.map((u) => (
                                                        <button
                                                            key={u.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData({ ...formData, assignedToId: u.id });
                                                                setIsUserDropdownOpen(false);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 last:border-0"
                                                        >
                                                            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 dark:border-white/10">
                                                                {u.avatar ? (
                                                                    <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                                        {u.name?.charAt(0).toUpperCase()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col items-start min-w-0">
                                                                <span className="text-gray-900 dark:text-white truncate w-full">{u.name}</span>
                                                                <span className="text-[10px] text-gray-500 truncate w-full">{u.email}</span>
                                                            </div>
                                                            {formData.assignedToId === u.id && <Check size={14} className="text-blue-500" />}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
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
                                                        className={`w-full text-left px-4 py-3 transition-colors group flex items-start gap-2 ${activeTicket?.id === t.id ? 'bg-blue-500/15' : 'hover:bg-white/5'}`}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                                {/* Changed from text-xs to text-sm to match the message section  */}
                                                                <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                                    {t.subject}
                                                                </span>
                                                            </div>
                                                            {/* Changed from text-[11px] to text-sm  */}
                                                            <p className="text-sm text-gray-500 line-clamp-1">
                                                                {t.message}
                                                            </p>
                                                            <div className="mt-1"><TicketStatusBadge status={t.status} /></div>
                                                        </div>
                                                        <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 shrink-0 mt-1 group-hover:text-blue-400 transition-colors" />
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

                                                    {/* Updated Badge & Resolve Button Container */}
                                                    <div className="flex flex-col items-end gap-2">
                                                        <TicketStatusBadge status={activeTicket.status} />

                                                        {activeTicket.status !== 'resolved' && (
                                                            <button
                                                                onClick={handleResolve}
                                                                disabled={resolving}
                                                                className="px-2 py-1 mt-1 bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 disabled:opacity-50"
                                                            >
                                                                <CheckCircle size={10} />
                                                                {resolving ? 'Resolving...' : 'Mark Resolved'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                                                {/* Subject and Date removed as they are now in the static header */}

                                                <div className="bg-white/5 rounded-3xl p-6 border border-white/5 shadow-inner">
                                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"><User size={12} /> User Message</p>
                                                    <p className="text-sm text-gray-300 leading-relaxed">{activeTicket.message}</p>
                                                </div>

                                                {activeTicket.adminReply && (
                                                    <div className="bg-blue-500/5 rounded-3xl p-6 border border-blue-500/10">
                                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2"><CheckCircle size={12} /> System Resolution</p>
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

            {/* ── Delete Confirmation Modal ── */}
            <ConfirmModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={executeDelete}
                title="Delete Workstation"
                message="Are you sure you want to permanently delete this workstation? This action cannot be undone."
                confirmText="Delete"
                isDangerous={true}
            />
        </div>
    );
};

export default ITTWorkstations;
