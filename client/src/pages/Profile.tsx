import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { toast } from 'react-toastify';
import { 
  User, Camera, Loader2, Mail, Shield, Check, 
  ArrowLeft, Sparkles, HardDrive, Folder, Calendar, Clock
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';

// --- TYPES ---
interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    assets: number;
    collections: number;
  };
}

const Profile = () => {
  const { user: currentUser, login } = useAuth();
  const { id } = useParams(); 
  const navigate = useNavigate();

  // Logic: Is this MY profile?
  const isOwnProfile = !id || (currentUser && id === currentUser.id);
  const isAdminView = currentUser?.role === 'admin' && !isOwnProfile;

  // --- STATE ---
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit Form (Self)
  const [name, setName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin Actions (Others)
  const [role, setRole] = useState('');
  
  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- 1. FETCH DATA ---
  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        try {
            if (isOwnProfile) {
                if (currentUser) {
                    setProfileData(currentUser as unknown as UserProfile);
                    setName(currentUser.name || '');
                    setAvatarPreview(currentUser.avatar || null);
                }
            } else {
                const { data } = await client.get(`/users/${id}`);
                setProfileData(data);
                setName(data.name || '');
                setRole(data.role);
                setAvatarPreview(data.avatar || null);
            }
        } catch (error) {
            toast.error("User not found");
            navigate('/users');
        } finally {
            setIsLoading(false);
        }
    };
    
    if (currentUser) loadData();
  }, [id, currentUser, isOwnProfile, navigate]);

  // --- 2. ACTIONS ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setAvatarFile(file);
          setAvatarPreview(URL.createObjectURL(file));
      }
  };

  const handleSelfUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
          const formData = new FormData();
          formData.append('name', name);
          if (avatarFile) formData.append('avatar', avatarFile);

          const { data: updatedUser } = await client.patch('/users/profile', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });

          const token = localStorage.getItem('token') || '';
          login(token, updatedUser);
          toast.success("Profile updated!");
          setAvatarFile(null);
      } catch (error) { 
          toast.error("Failed to update profile"); 
      } finally { 
          setIsSaving(false); 
      }
  };

  const handleAdminRoleUpdate = async () => {
      if (!profileData || isSaving) return;
      setIsSaving(true);
      try {
          await client.put(`/users/${profileData.id}/role`, { role }); 
          toast.success("User role updated");
          setProfileData({ ...profileData, role });
      } catch (e) { 
          toast.error("Failed to update role"); 
      } finally { 
          setIsSaving(false); 
      }
  };

  const handleExecuteDelete = async () => {
      if (!profileData) return;
      setIsDeleting(true);
      try {
          await client.delete(`/users/${profileData.id}`);
          toast.success("User deleted successfully");
          navigate('/users');
      } catch (e: any) { 
          toast.error(e.response?.data?.message || "Failed to delete user"); 
      } finally {
          setIsDeleting(false);
          setIsDeleteModalOpen(false);
      }
  };

  // ✅ NEW: SKELETON LOADER
  if (isLoading || !profileData) return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto animate-pulse">
            <div className="h-8 w-24 bg-gray-200 dark:bg-white/5 rounded-lg mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Skeleton */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white dark:bg-[#1A1D21] rounded-3xl p-6 h-[400px] border border-gray-200 dark:border-white/5 flex flex-col items-center">
                        <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-white/5 mb-4"></div>
                        <div className="h-6 w-32 bg-gray-200 dark:bg-white/5 rounded mb-2"></div>
                        <div className="h-4 w-48 bg-gray-200 dark:bg-white/5 rounded mb-6"></div>
                        <div className="w-full h-px bg-gray-100 dark:bg-white/5 mb-4"></div>
                        <div className="w-full space-y-3">
                            <div className="h-4 w-full bg-gray-200 dark:bg-white/5 rounded"></div>
                            <div className="h-4 w-full bg-gray-200 dark:bg-white/5 rounded"></div>
                        </div>
                    </div>
                </div>
                {/* Right Skeleton */}
                <div className="lg:col-span-8">
                    <div className="bg-white dark:bg-[#1A1D21] rounded-3xl p-8 h-[300px] border border-gray-200 dark:border-white/5">
                        <div className="h-8 w-48 bg-gray-200 dark:bg-white/5 rounded mb-6"></div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="h-12 bg-gray-200 dark:bg-white/5 rounded-xl"></div>
                            <div className="h-12 bg-gray-200 dark:bg-white/5 rounded-xl"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] transition-colors duration-500 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Back Button */}
        <button onClick={() => navigate(-1)} className="group mb-6 flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium text-sm">
            <div className="p-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 group-hover:border-blue-200 transition-colors shadow-sm"><ArrowLeft size={16} /></div>
            {isAdminView ? 'Back to Team' : 'Back'}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* --- LEFT COLUMN: IDENTITY CARD (4 Cols) --- */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-white dark:bg-[#1A1D21] rounded-3xl shadow-sm border border-gray-200 dark:border-white/5 overflow-hidden p-6 text-center relative">
                    
                    {/* Role Badge */}
                    <div className="absolute top-4 right-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                            profileData.role === 'admin' 
                                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' 
                                : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                        }`}>
                            {profileData.role}
                        </span>
                    </div>

                    {/* Avatar */}
                    <div className="relative inline-block mb-4 group mt-4">
                        <div className="h-32 w-32 rounded-full border-4 border-white dark:border-[#1A1D21] bg-gray-100 dark:bg-black overflow-hidden mx-auto flex items-center justify-center shadow-xl ring-1 ring-gray-200 dark:ring-white/10">
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-4xl font-bold text-gray-400">{profileData.name?.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        {isOwnProfile && (
                            <button 
                                onClick={() => fileInputRef.current?.click()} 
                                className="absolute bottom-1 right-1 p-2.5 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition-all border-2 border-white dark:border-[#1A1D21]"
                                title="Change Avatar"
                            >
                                <Camera size={14} />
                            </button>
                        )}
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    </div>

                    <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{profileData.name}</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-center justify-center gap-1.5">
                        <Mail size={12} /> {profileData.email}
                    </p>

                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2 border-t border-gray-100 dark:border-white/5 pt-4">
                        <div className="flex items-center justify-between px-4">
                            <span className="flex items-center gap-2"><Calendar size={12}/> Joined</span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                                {profileData.createdAt ? new Date(profileData.createdAt).toLocaleDateString() : 'N/A'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-4">
                            <span className="flex items-center gap-2"><Clock size={12}/> Last Active</span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                                {profileData.updatedAt ? new Date(profileData.updatedAt).toLocaleDateString() : 'Just now'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Stats Card */}
                {profileData._count && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-[#1A1D21] p-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm text-center">
                            <div className="mx-auto w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center mb-2"><HardDrive size={20}/></div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">{profileData._count.assets}</div>
                            <div className="text-xs font-medium text-gray-500">Uploads</div>
                        </div>
                        <div className="bg-white dark:bg-[#1A1D21] p-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm text-center">
                            <div className="mx-auto w-10 h-10 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center mb-2"><Folder size={20}/></div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">{profileData._count.collections}</div>
                            <div className="text-xs font-medium text-gray-500">Collections</div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- RIGHT COLUMN: FORMS & ACTIONS (8 Cols) --- */}
            <div className="lg:col-span-8 space-y-6">
                
                {/* 1. EDIT PROFILE FORM (Only if Self) */}
                {isOwnProfile && (
                    <div className="bg-white dark:bg-[#1A1D21] rounded-3xl shadow-sm border border-gray-200 dark:border-white/5 p-8">
                        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-white/5">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-lg"><User size={20}/></div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Profile Settings</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Update your personal information</p>
                            </div>
                        </div>
                        
                        <form onSubmit={handleSelfUpdate} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Display Name</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm" />
                                </div>
                                <div className="space-y-2 opacity-70">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Email Address</label>
                                    <input type="email" value={profileData.email} disabled className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-500 cursor-not-allowed text-sm" />
                                </div>
                            </div>
                            <div className="pt-2 flex justify-end">
                                <button type="submit" disabled={isSaving} className="px-6 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black font-bold text-sm hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-70 flex items-center gap-2">
                                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* 2. ADMIN ACTIONS (Only if Admin Viewing Other) */}
                {isAdminView && (
                    <div className="bg-white dark:bg-[#1A1D21] rounded-3xl shadow-sm border border-orange-200 dark:border-orange-900/30 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 text-orange-600 rounded-lg"><Sparkles size={20}/></div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Admin Controls</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Manage permissions for this user</p>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-white/5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-3">Change System Role</label>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <select value={role} onChange={(e) => setRole(e.target.value)} className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-[#1A1D21] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none focus:border-orange-500 text-sm cursor-pointer">
                                        <option value="viewer">Viewer (Read Only)</option>
                                        <option value="editor">Editor (Can Upload)</option>
                                        <option value="admin">Admin (Full Access)</option>
                                    </select>
                                    <button onClick={handleAdminRoleUpdate} disabled={isSaving || role === profileData.role} className="px-5 py-2.5 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 disabled:opacity-50 transition-colors shadow-sm">
                                        Update Role
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-2"><Shield size={14}/> Danger Zone</h3>
                                <div className="p-4 rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <p className="text-xs text-red-600/80 dark:text-red-400/80">
                                        Deleting a user will permanently remove <strong>all their uploads</strong> and <strong>collections</strong>. This cannot be undone.
                                    </p>
                                    <button 
                                        onClick={() => setIsDeleteModalOpen(true)}
                                        className="shrink-0 px-4 py-2 bg-white dark:bg-transparent border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-bold text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm"
                                    >
                                        Delete User
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
      </div>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleExecuteDelete}
        title="Delete User?"
        message={`Are you sure you want to permanently delete ${profileData?.name}? This action will wipe all their data and cannot be undone.`}
        confirmText="Yes, Delete User"
        isDangerous={true}
        isLoading={isDeleting}
      />

    </div>
  );
};

export default Profile;