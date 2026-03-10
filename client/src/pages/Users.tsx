import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Trash2, Shield, CheckCircle2, XCircle, 
  ChevronLeft, ChevronRight, Loader2, Plus, Mail, Lock, X, 
  MoreHorizontal, UserCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import { Link } from 'react-router-dom';

// --- TYPES ---
interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserResponse {
  data: User[];
  meta: { total: number; page: number; limit: number; totalPages: number; };
}

const UsersPage = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'viewer' });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery<UserResponse>({
    queryKey: ['users', page, debouncedSearch, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(), limit: '10', search: debouncedSearch,
        ...(roleFilter !== 'all' && { role: roleFilter })
      });
      const res = await client.get(`/users?${params}`);
      return res.data;
    },
    staleTime: 5000, 
    placeholderData: (previousData) => previousData, 
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => client.put(`/users/${id}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUserId(null);
      toast.success('Role updated successfully');
    },
    onError: () => toast.error('Failed to update role'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => client.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setUserToDelete(null);
      toast.success('User removed from workspace');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete user')
  });

  const approveUserMutation = useMutation({
    mutationFn: async (id: string) => client.post(`/users/${id}/approve`, { role: 'viewer' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('User access approved');
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => client.post('/users', userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsAddModalOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'viewer' });
      toast.success('Team member added');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to add member')
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try { await createUserMutation.mutateAsync(newUser); } 
    finally { setIsCreating(false); }
  };

  // --- UI COMPONENTS ---
  const RoleBadge = ({ role }: { role: string }) => {
    const isEditing = editingUserId !== null;
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
          role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20' :
          role === 'editor' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' :
          'bg-gray-100 text-gray-700 border-gray-200 dark:bg-white/5 dark:text-gray-300 dark:border-white/10'
      }`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  const StatusDot = ({ status }: { status: string }) => {
    const isPending = status === 'PENDING';
    return (
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isPending ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{status.toLowerCase()}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-4 lg:p-8 pb-24 transition-colors duration-300">
      
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Team</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage members and their access to this workspace.</p>
          </div>
          <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-black px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
          >
              <Plus size={16} /> Invite Member
          </button>
        </div>

        {/* MAIN UNIFIED PANE */}
        <div className="bg-white dark:bg-[#111111] rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col">
            
            {/* TOOLBAR */}
            <div className="p-4 border-b border-gray-200 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-[#111111]">
                
                {/* Sleek Underline Tabs */}
                <div className="flex gap-1 bg-gray-100/50 dark:bg-white/5 p-1 rounded-lg w-full sm:w-auto">
                    {['all', 'admin', 'editor', 'viewer'].map((role) => (
                        <button
                            key={role}
                            onClick={() => { setRoleFilter(role); setPage(1); }}
                            className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${
                                roleFilter === role 
                                ? 'bg-white dark:bg-[#222222] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-white/5' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-white/5'
                            }`}
                        >
                            {role}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                    <input 
                        type="text" 
                        placeholder="Search team members..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm text-gray-900 dark:text-white transition-all shadow-sm"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-gray-50/50 dark:bg-transparent border-b border-gray-200 dark:border-white/10">
                        <tr>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">User</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Role</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Joined</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-white/5" /><div className="space-y-2"><div className="h-3 w-24 bg-gray-200 dark:bg-white/5 rounded" /><div className="h-2 w-32 bg-gray-200 dark:bg-white/5 rounded" /></div></div></td>
                                    <td className="px-6 py-4"><div className="h-6 w-16 bg-gray-200 dark:bg-white/5 rounded-md" /></td>
                                    <td className="px-6 py-4"><div className="h-4 w-20 bg-gray-200 dark:bg-white/5 rounded" /></td>
                                    <td className="px-6 py-4"><div className="h-4 w-24 bg-gray-200 dark:bg-white/5 rounded" /></td>
                                    <td className="px-6 py-4 text-right"><div className="h-6 w-6 bg-gray-200 dark:bg-white/5 rounded ml-auto" /></td>
                                </tr>
                            ))
                        ) : data?.data.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-full mb-3 text-gray-400">
                                            <UserCircle size={24} />
                                        </div>
                                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">No users found</h3>
                                        <p className="text-sm text-gray-500 mt-1">Adjust your search or add a new member.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            data?.data.map((user) => (
                                <tr key={user.id} className="group hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                    
                                    {/* User Info */}
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center overflow-hidden shrink-0 text-gray-600 dark:text-gray-300 font-semibold text-xs border border-gray-200 dark:border-gray-700">
                                                {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : <span>{user.name?.charAt(0) || user.email.charAt(0)}</span>}
                                            </div>
                                            <div className="flex flex-col">
                                                <Link to={`/profile/${user.id}`} className="font-medium text-gray-900 dark:text-gray-100 text-sm hover:text-blue-600 dark:hover:text-blue-400">
                                                    {user.name || 'Unnamed User'} {user.id === currentUser?.id && <span className="text-gray-400 ml-1 font-normal">(You)</span>}
                                                </Link>
                                                <p className="text-xs text-gray-500">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Role */}
                                    <td className="px-6 py-3">
                                        {editingUserId === user.id ? (
                                            <select
                                                autoFocus
                                                value={user.role}
                                                onChange={(e) => updateRoleMutation.mutate({ id: user.id, role: e.target.value })}
                                                onBlur={() => setEditingUserId(null)}
                                                className="bg-white dark:bg-[#222222] border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs font-medium outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/50"
                                            >
                                                <option value="admin">Admin</option>
                                                <option value="editor">Editor</option>
                                                <option value="viewer">Viewer</option>
                                            </select>
                                        ) : (
                                            <div 
                                                onClick={() => user.id !== currentUser?.id && setEditingUserId(user.id)}
                                                className={user.id !== currentUser?.id ? 'cursor-pointer hover:opacity-80' : ''}
                                            >
                                                <RoleBadge role={user.role} />
                                            </div>
                                        )}
                                    </td>

                                    {/* Status */}
                                    <td className="px-6 py-3">
                                        <StatusDot status={user.status} />
                                    </td>

                                    {/* Joined */}
                                    <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
                                        {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-6 py-3 text-right">
                                        {user.status === 'PENDING' ? (
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => approveUserMutation.mutate(user.id)} className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 transition-colors">Approve</button>
                                                <button onClick={() => deleteUserMutation.mutate(user.id)} className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">Reject</button>
                                            </div>
                                        ) : (
                                            user.id !== currentUser?.id && (
                                                <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setEditingUserId(user.id)} className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md transition-colors" title="Edit Role"><Shield size={15} /></button>
                                                    <button onClick={() => setUserToDelete(user)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-md transition-colors" title="Remove User"><Trash2 size={15} /></button>
                                                </div>
                                            )
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* PAGINATION */}
            {data && data.meta.total > 0 && !isLoading && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-transparent flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Showing <span className="font-medium text-gray-900 dark:text-gray-200">{((page - 1) * data.meta.limit) + 1}</span> to <span className="font-medium text-gray-900 dark:text-gray-200">{Math.min(page * data.meta.limit, data.meta.total)}</span> of <span className="font-medium text-gray-900 dark:text-gray-200">{data.meta.total}</span>
                </span>
                
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"><ChevronLeft size={16} /></button>
                  <button onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="p-1.5 rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* ADD MEMBER MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
              <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="relative w-full max-w-md bg-white dark:bg-[#111111] rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-white/10">
                  <div className="flex justify-between items-start mb-5">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Invite Member</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Add a new user to your workspace.</p>
                      </div>
                      <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"><X size={18} /></button>
                  </div>
                  
                  <form onSubmit={handleCreateSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Name</label>
                          <input type="text" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#1A1A1A] px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-sm" placeholder="Jane Doe" />
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                          <input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#1A1A1A] px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-sm" placeholder="jane@company.com" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Password</label>
                            <input type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#1A1A1A] px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-sm" placeholder="••••••••" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Role</label>
                            <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#1A1A1A] px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-sm cursor-pointer">
                                <option value="viewer">Viewer</option>
                                <option value="editor">Editor</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                      </div>
                      <div className="pt-4">
                          <button type="submit" disabled={isCreating} className="w-full rounded-lg bg-black dark:bg-white text-white dark:text-black font-medium py-2.5 hover:opacity-90 transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                              {isCreating && <Loader2 className="animate-spin" size={16} />}
                              {isCreating ? 'Sending Invite...' : 'Send Invite'}
                          </button>
                      </div>
                  </form>
              </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
        title="Remove User"
        message={`Are you sure you want to permanently remove ${userToDelete?.name}?`}
        confirmText="Remove User"
        isDangerous={true}
        isLoading={deleteUserMutation.isPending}
      />
    </div>
  );
};

export default UsersPage;