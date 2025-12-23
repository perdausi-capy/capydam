import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import { 
  Search, 
  Trash2, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Mail,
  Lock,
  X
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
  updatedAt: string; // ✅ ADDED TYPE
}

interface UserResponse {
  data: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const UsersPage = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // --- STATE ---
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Modals State
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // New User Form State
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'viewer' });
  const [isCreating, setIsCreating] = useState(false);

  // --- DATA FETCHING ---
  const { data, isLoading } = useQuery<UserResponse>({
    queryKey: ['users', page, search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        ...(roleFilter !== 'all' && { role: roleFilter })
      });
      const res = await client.get(`/users?${params}`);
      return res.data;
    },
    staleTime: 5000, 
    placeholderData: (previousData) => previousData, 
  });

  // --- MUTATIONS ---
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await client.put(`/users/${id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUserId(null);
      toast.success('Role updated successfully');
    },
    onError: () => toast.error('Failed to update role'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setUserToDelete(null);
      toast.success('User deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  });

  const approveUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.post(`/users/${id}/approve`, { role: 'viewer' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('User approved');
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      await client.post('/users', userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsAddModalOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'viewer' });
      toast.success('User created successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create user');
    }
  });

  // --- HANDLERS ---
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleRoleChange = (role: string) => {
    setRoleFilter(role);
    setPage(1);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
        await createUserMutation.mutateAsync(newUser);
    } finally {
        setIsCreating(false);
    }
  };

  // --- RENDER HELPERS ---
  const RoleBadge = ({ role }: { role: string }) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
      editor: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
      viewer: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${colors[role] || colors.viewer}`}>
        {role}
      </span>
    );
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const isPending = status === 'PENDING';
    return (
      <span className={`flex w-fit items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
        isPending 
          ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' 
          : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isPending ? 'bg-yellow-500' : 'bg-green-500'}`} />
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] p-4 lg:p-8 pb-24">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Management</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage users, roles, and access permissions.</p>
        </div>
        <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-all shadow-lg"
        >
            <Plus size={18} /> Add Member
        </button>
      </div>

      {/* FILTERS TOOLBAR */}
      <div className="bg-white dark:bg-[#15171B] p-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm mb-6 flex flex-col md:flex-row justify-between gap-4 items-center">
        
        {/* Role Tabs */}
        <div className="flex p-1 bg-gray-100 dark:bg-black/20 rounded-xl w-full md:w-auto overflow-x-auto">
          {['all', 'admin', 'editor', 'viewer'].map((role) => (
            <button
              key={role}
              onClick={() => handleRoleChange(role)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all capitalize whitespace-nowrap ${
                roleFilter === role 
                  ? 'bg-white dark:bg-[#1A1D21] text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={search}
            onChange={handleSearch}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white transition-all"
          />
        </div>
      </div>

      {/* USERS TABLE */}
      <div className="bg-white dark:bg-[#15171B] rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 text-gray-400">
            <Loader2 className="animate-spin mb-2 text-blue-600" size={32} />
            <p>Loading team members...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joined</th>
                  {/* ✅ ADDED LAST ACCESS HEADER */}
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Access</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {data?.data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No users found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  data?.data.map((user) => (
                    <tr key={user.id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      
                      {/* USER INFO */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden shrink-0 border border-gray-100 dark:border-white/10">
                            {user.avatar ? (
                              <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="font-bold text-gray-500 text-sm uppercase">{user.name?.charAt(0) || user.email.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white text-sm">{user.name || 'Unnamed'}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* STATUS */}
                      <td className="px-6 py-4">
                        <StatusBadge status={user.status} />
                      </td>

                      {/* ROLE */}
                      <td className="px-6 py-4">
                        {editingUserId === user.id ? (
                          <select
                            autoFocus
                            value={user.role}
                            onChange={(e) => updateRoleMutation.mutate({ id: user.id, role: e.target.value })}
                            onBlur={() => setEditingUserId(null)}
                            className="bg-white dark:bg-[#1A1D21] border border-blue-500 rounded-lg px-2 py-1 text-sm outline-none text-gray-900 dark:text-white shadow-sm"
                          >
                            <option value="admin">Admin</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <div 
                            onClick={() => user.id !== currentUser?.id && setEditingUserId(user.id)} 
                            className={`inline-block ${user.id !== currentUser?.id ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                            title={user.id !== currentUser?.id ? "Click to change role" : ""}
                          >
                            <RoleBadge role={user.role} />
                          </div>
                        )}
                      </td>

                      {/* JOINED DATE */}
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>

                      {/* ✅ LAST ACCESS COLUMN */}
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : '-'}
                      </td>

                      {/* ACTIONS */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          
                          {/* PENDING ACTIONS */}
                          {user.status === 'PENDING' ? (
                            <>
                              <button 
                                onClick={() => approveUserMutation.mutate(user.id)}
                                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" 
                                title="Approve"
                              >
                                <CheckCircle2 size={18} />
                              </button>
                              <button 
                                onClick={() => deleteUserMutation.mutate(user.id)}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Reject"
                              >
                                <XCircle size={18} />
                              </button>
                            </>
                          ) : (
                            // ACTIVE USERS ACTIONS
                            user.id !== currentUser?.id && (
                                <>
                                <Link 
                                    to={`/profile/${user.id}`}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                    title="View Profile"
                                >
                                    <UserIcon size={18} />
                                </Link>
                                <button 
                                    onClick={() => setEditingUserId(user.id)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                    title="Edit Role"
                                >
                                    <Shield size={18} />
                                </button>
                                <button 
                                    onClick={() => setUserToDelete(user)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="Delete User"
                                >
                                    <Trash2 size={18} />
                                </button>
                                </>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION FOOTER */}
        {data && data.meta.total > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20">
            <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
              Showing <span className="font-bold">{((page - 1) * data.meta.limit) + 1}</span> to <span className="font-bold">{Math.min(page * data.meta.limit, data.meta.total)}</span> of <span className="font-bold">{data.meta.total}</span> users
            </span>
            
            <div className="flex items-center gap-2 ml-auto">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 disabled:opacity-50 hover:bg-white dark:hover:bg-white/5 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">
                Page {page} of {data.meta.totalPages}
              </span>
              <button 
                onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
                disabled={page === data.meta.totalPages}
                className="p-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 disabled:opacity-50 hover:bg-white dark:hover:bg-white/5 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ADD MEMBER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
            <div className="relative w-full max-w-md bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add New Member</h3>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
                </div>
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Full Name</label>
                        <div className="relative">
                            <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30" placeholder="John Doe" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Email Address</label>
                        <div className="relative">
                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30" placeholder="john@company.com" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Password</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30" placeholder="••••••••" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Role</label>
                        <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 cursor-pointer">
                            <option value="viewer">Viewer (Read Only)</option>
                            <option value="editor">Editor (Can Upload)</option>
                            <option value="admin">Admin (Full Access)</option>
                        </select>
                    </div>
                    <div className="pt-4">
                        <button type="submit" disabled={isCreating} className="w-full rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-3 hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2">
                            {isCreating && <Loader2 className="animate-spin" size={18} />}
                            {isCreating ? 'Creating...' : 'Create Member'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      <ConfirmModal 
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.name}? This will permanently delete all their assets and collections.`}
        confirmText="Delete User"
        isDangerous={true}
        isLoading={deleteUserMutation.isPending}
      />

    </div>
  );
};

export default UsersPage;