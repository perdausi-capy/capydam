import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Check, X, User, Loader2, ShieldAlert } from 'lucide-react';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string; // 'PENDING' | 'ACTIVE'
}

const Users = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
    try {
      const { data } = await client.get('/users');
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (user: UserData) => {
    // 1. Ask for Role
    const role = prompt(`Approve ${user.name}? Enter role (viewer, editor, admin):`, 'viewer');
    if (!role) return; // Cancelled
    if (!['viewer', 'editor', 'admin'].includes(role.toLowerCase())) {
      alert('Invalid role. Please type viewer, editor, or admin.');
      return;
    }

    try {
      await client.patch(`/users/${user.id}/approve`, { role: role.toLowerCase() });
      fetchUsers(); // Refresh
    } catch (error) {
      alert('Failed to approve user');
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirm('Reject and delete this user request?')) return;
    try {
      await client.delete(`/auth/users/${userId}/reject`);
      fetchUsers();
    } catch (error) {
      alert('Failed to reject user');
    }
  };

  // Separate lists
  const pendingUsers = users.filter(u => u.status === 'PENDING');
  const activeUsers = users.filter(u => u.status === 'ACTIVE');

  if (loading) return <div className="p-10"><Loader2 className="animate-spin"/></div>;
  if (currentUser?.role !== 'admin') return <div className="p-10">Access Denied.</div>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">User Management</h1>

      {/* --- PENDING REQUESTS SECTION --- */}
      {pendingUsers.length > 0 && (
        <div className="mb-8 rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <div className="mb-4 flex items-center text-yellow-800">
            <ShieldAlert className="mr-2" />
            <h2 className="text-lg font-bold">Pending Requests ({pendingUsers.length})</h2>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingUsers.map(u => (
              <div key={u.id} className="flex flex-col justify-between rounded-lg bg-white p-4 shadow-sm border">
                <div>
                  <h3 className="font-bold text-gray-900">{u.name}</h3>
                  <p className="text-sm text-gray-500">{u.email}</p>
                  <p className="mt-1 text-xs text-yellow-600 font-semibold">Awaiting Approval</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button 
                    onClick={() => handleApprove(u)}
                    className="flex flex-1 items-center justify-center rounded bg-green-600 py-2 text-sm font-bold text-white hover:bg-green-700"
                  >
                    <Check size={16} className="mr-1" /> Approve
                  </button>
                  <button 
                    onClick={() => handleReject(u.id)}
                    className="flex flex-1 items-center justify-center rounded bg-red-100 py-2 text-sm font-bold text-red-600 hover:bg-red-200"
                  >
                    <X size={16} className="mr-1" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- ACTIVE USERS TABLE --- */}
      <div className="overflow-hidden rounded-lg border bg-white shadow">
        <div className="border-b bg-gray-50 px-6 py-3">
            <h2 className="font-bold text-gray-700">Active Users</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <tbody className="divide-y divide-gray-200 bg-white">
            {activeUsers.map((u) => (
              <tr key={u.id}>
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                      {u.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-900">{u.name}</div>
                        <div className="text-sm text-gray-500">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                    u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                    u.role === 'editor' ? 'bg-green-100 text-green-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {/* You can add Edit/Delete Active User logic here if needed */}
                   <span className="text-gray-400">Active</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;