import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
    Check, 
    X, 
    Loader2, 
    ShieldAlert, 
    Users as UsersIcon, 
    UserPlus, 
    Shield, 
    Plus,
    Mail,
    Lock,
    User
} from 'lucide-react';
import { toast } from 'react-toastify';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt?: string;
}

const Users = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();
  
  // State for role selection in pending cards
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});

  // State for "Add Member" Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'viewer' });
  const [isCreating, setIsCreating] = useState(false);

  const fetchUsers = async () => {
    try {
      const { data } = await client.get('/users');
      setUsers(data);
    } catch (error) {
      toast.error('Failed to load user list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = (userId: string, role: string) => {
    setSelectedRoles(prev => ({ ...prev, [userId]: role }));
  };

  const handleApprove = async (user: UserData) => {
    const roleToAssign = selectedRoles[user.id] || 'viewer';
    try {
      await client.patch(`/users/${user.id}/approve`, { role: roleToAssign });
      toast.success(`${user.name} approved as ${roleToAssign}`);
      fetchUsers(); 
    } catch (error) {
      toast.error('Failed to approve user');
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirm('Reject and delete this user request?')) return;
    try {
      await client.delete(`/users/${userId}/reject`); // Check your route path! might be /users/:id/reject depending on previous setup
      toast.info('User request rejected');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to reject user');
    }
  };

  // --- HANDLE ADD MEMBER ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
        await client.post('/users', newUser);
        toast.success(`User ${newUser.name} created successfully`);
        setIsAddModalOpen(false);
        setNewUser({ name: '', email: '', password: '', role: 'viewer' }); // Reset
        fetchUsers();
    } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
        setIsCreating(false);
    }
  };

  const pendingUsers = users.filter(u => u.status === 'PENDING');
  const activeUsers = users.filter(u => u.status === 'ACTIVE');

  const stats = [
      { label: 'Total Members', value: activeUsers.length, icon: UsersIcon, bgLight: 'bg-blue-50 text-blue-600', bgDark: 'dark:bg-blue-900/20 dark:text-blue-400' },
      { label: 'Pending Requests', value: pendingUsers.length, icon: UserPlus, bgLight: 'bg-yellow-50 text-yellow-600', bgDark: 'dark:bg-yellow-900/20 dark:text-yellow-400' },
      { label: 'Admins', value: activeUsers.filter(u => u.role === 'admin').length, icon: Shield, bgLight: 'bg-purple-50 text-purple-600', bgDark: 'dark:bg-purple-900/20 dark:text-purple-400' },
  ];

  if (loading) return <div className="flex h-screen items-center justify-center dark:bg-[#0B0D0F]"><Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={32}/></div>;
  if (currentUser?.role !== 'admin') return <div className="p-10 text-center text-red-500 font-bold dark:bg-[#0B0D0F] h-screen">Access Denied. Admin privileges required.</div>;

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0B0D0F] p-6 md:p-10 transition-colors duration-500">
      
      {/* HEADER */}
      <div className="mx-auto max-w-6xl mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Team Management</h1>
                <p className="text-gray-500 dark:text-gray-400">Manage access and roles for your organization.</p>
            </div>
            
            {/* ADD MEMBER BUTTON */}
            <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-all shadow-lg shadow-gray-200 dark:shadow-none"
            >
                <Plus size={18} /> Add Member
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, idx) => (
                <div key={idx} className="bg-white dark:bg-[#1A1D21] rounded-2xl border border-gray-200 dark:border-white/5 p-6 flex items-center gap-5 shadow-sm hover:shadow-md transition-all">
                    <div className={`p-3.5 rounded-xl ${stat.bgLight} ${stat.bgDark}`}>
                        <stat.icon size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                    </div>
                </div>
            ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl">
        
        {/* PENDING REQUESTS */}
        {pendingUsers.length > 0 && (
            <div className="mb-10 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-3 mb-5">
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Pending Requests</h2>
                    <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-bold px-2 py-0.5 rounded-full">{pendingUsers.length}</span>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {pendingUsers.map(u => (
                    <div key={u.id} className="flex flex-col rounded-2xl bg-white dark:bg-[#1A1D21] border border-yellow-200 dark:border-yellow-900/30 shadow-sm overflow-hidden transition-colors">
                        <div className="p-5 border-b border-gray-100 dark:border-white/5 bg-yellow-50/50 dark:bg-yellow-900/10">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">{u.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{u.email}</p>
                                </div>
                                <ShieldAlert className="text-yellow-500 dark:text-yellow-400" size={20} />
                            </div>
                        </div>
                        <div className="p-5 flex-1 flex flex-col gap-5">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-2">Assign Role</label>
                                <select 
                                    className="w-full rounded-xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 py-2.5 px-3 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:ring-blue-500 outline-none transition-all cursor-pointer"
                                    value={selectedRoles[u.id] || 'viewer'}
                                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                >
                                    <option value="viewer">Viewer</option>
                                    <option value="editor">Editor</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="flex gap-3 mt-auto">
                                <button onClick={() => handleApprove(u)} className="flex-1 flex items-center justify-center rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 transition-colors shadow-sm hover:shadow-md">
                                    <Check size={16} className="mr-2" /> Approve
                                </button>
                                <button onClick={() => handleReject(u.id)} className="flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/10 px-4 py-2.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                    ))}
                </div>
            </div>
        )}

        {/* ACTIVE USERS TABLE */}
        <div className="bg-white dark:bg-[#1A1D21] rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden transition-colors">
            <div className="border-b border-gray-200 dark:border-white/5 px-6 py-4 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                <h2 className="font-bold text-gray-800 dark:text-white">Active Members</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-white/5">
                    <thead className="bg-gray-50 dark:bg-black/20">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joined</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-[#1A1D21] divide-y divide-gray-200 dark:divide-white/5">
                        {activeUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm border border-white/10">
                                        {u.name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">{u.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${
                                    u.role === 'admin' 
                                        ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800/30' 
                                        : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                                }`}>
                                    {u.role}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-100 dark:border-green-800/30">
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 dark:bg-green-400" />
                                    Active
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                            </td>
                        </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {/* --- ADD MEMBER MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
            
            <div className="relative w-full max-w-md bg-white dark:bg-[#1A1D21] rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add New Member</h3>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Full Name</label>
                        <div className="relative">
                            <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input 
                                type="text" 
                                required
                                value={newUser.name}
                                onChange={e => setNewUser({...newUser, name: e.target.value})}
                                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                                placeholder="John Doe"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Email Address</label>
                        <div className="relative">
                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input 
                                type="email" 
                                required
                                value={newUser.email}
                                onChange={e => setNewUser({...newUser, email: e.target.value})}
                                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                                placeholder="john@company.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Password</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input 
                                type="password" 
                                required
                                value={newUser.password}
                                onChange={e => setNewUser({...newUser, password: e.target.value})}
                                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Role</label>
                        <select
                            value={newUser.role}
                            onChange={e => setNewUser({...newUser, role: e.target.value})}
                            className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 cursor-pointer"
                        >
                            <option value="viewer">Viewer (Read Only)</option>
                            <option value="editor">Editor (Can Upload)</option>
                            <option value="admin">Admin (Full Access)</option>
                        </select>
                    </div>

                    <div className="pt-4">
                        <button 
                            type="submit" 
                            disabled={isCreating}
                            className="w-full rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-3 hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isCreating ? 'Creating...' : 'Create Member'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default Users;