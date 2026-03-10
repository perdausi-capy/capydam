import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { 
  User, Camera, Loader2, Mail, Shield, Check, 
  ArrowLeft, Sparkles, HardDrive, Folder, Calendar, Clock, AlertTriangle
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
  const [isLoading, setIsLoading] = useState(true);
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
          toast.success("Profile updated successfully");
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

  // --- UI COMPONENTS ---
  const RoleBadge = ({ role }: { role: string }) => {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
          role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20' :
          role === 'editor' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' :
          'bg-gray-100 text-gray-700 border-gray-200 dark:bg-white/5 dark:text-gray-300 dark:border-white/10'
      }`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  // SKELETON LOADER
  if (isLoading || !profileData) return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-4 lg:p-8">
        <div className="max-w-5xl mx-auto animate-pulse">
            <div className="h-8 w-24 bg-gray-200 dark:bg-white/5 rounded-md mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-[#111111] rounded-xl p-6 h-[350px] border border-gray-200 dark:border-white/10"></div>
                </div>
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-[#111111] rounded-xl p-8 h-[250px] border border-gray-200 dark:border-white/10"></div>
                </div>
            </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] transition-colors duration-300 p-4 lg:p-8 pb-24">
      <div className="max-w-5xl mx-auto">
        
        {/* Back Button */}
        <button onClick={() => navigate(-1)} className="group mb-6 flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm font-medium">
            <div className="p-1.5 rounded-md bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 group-hover:border-gray-300 dark:group-hover:border-white/20 transition-colors shadow-sm">
                <ArrowLeft size={16} />
            </div>
            {isAdminView ? 'Back to Team' : 'Back'}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* --- LEFT COLUMN: IDENTITY CARD --- */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col items-center p-6 text-center relative">
                    
                    {/* Role Badge */}
                    <div className="absolute top-4 right-4">
                        <RoleBadge role={profileData.role} />
                    </div>

                    {/* Avatar with Sleek Hover Edit Overlay */}
                    <div className="relative mt-4 mb-5 group">
                        <div className="h-28 w-28 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center overflow-hidden shadow-md border-4 border-white dark:border-[#111111] ring-1 ring-gray-100 dark:ring-white/5">
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-4xl font-bold text-gray-500 dark:text-gray-400">{profileData.name?.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        
                        {isOwnProfile && (
                            <div 
                                onClick={() => fileInputRef.current?.click()} 
                                className="absolute inset-0 m-1 rounded-full bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity duration-200"
                            >
                                <Camera size={20} className="text-white mb-1" />
                                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Update</span>
                            </div>
                        )}
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    </div>

                    <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">{profileData.name}</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-center justify-center gap-1.5">
                        <Mail size={14} /> {profileData.email}
                    </p>

                    <div className="w-full text-xs text-gray-500 dark:text-gray-400 space-y-3 border-t border-gray-100 dark:border-white/10 pt-5">
                        <div className="flex items-center justify-between px-2">
                            <span className="flex items-center gap-2"><Calendar size={14}/> Joined</span>
                            <span className="font-medium text-gray-900 dark:text-gray-200">
                                {profileData.createdAt ? new Date(profileData.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-2">
                            <span className="flex items-center gap-2"><Clock size={14}/> Last Active</span>
                            <span className="font-medium text-gray-900 dark:text-gray-200">
                                {profileData.updatedAt ? new Date(profileData.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Just now'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Stats Cards (Now matching the sleek UI) */}
                {profileData._count && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm flex flex-col items-center justify-center text-center">
                            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2"><HardDrive size={16}/></div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white">{profileData._count.assets}</div>
                            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mt-0.5">Uploads</div>
                        </div>
                        <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm flex flex-col items-center justify-center text-center">
                            <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2"><Folder size={16}/></div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white">{profileData._count.collections}</div>
                            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mt-0.5">Collections</div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- RIGHT COLUMN: FORMS & ACTIONS --- */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* 1. EDIT PROFILE FORM (Only if Self) */}
                {isOwnProfile && (
                    <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
                        <div className="p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-white/10">
                                <div className="p-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 rounded-lg"><User size={18}/></div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Profile Settings</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Update your personal information</p>
                                </div>
                            </div>
                            
                            <form onSubmit={handleSelfUpdate} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Display Name</label>
                                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#1A1A1A] px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-sm" />
                                    </div>
                                    <div className="space-y-1.5 opacity-70">
                                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Email Address <span className="text-gray-400 font-normal">(Read Only)</span></label>
                                        <input type="email" value={profileData.email} disabled className="w-full rounded-lg border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm text-gray-500 cursor-not-allowed shadow-inner" />
                                    </div>
                                </div>
                                <div className="pt-4 flex justify-end">
                                    <button type="submit" disabled={isSaving} className="px-5 py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black font-medium text-sm hover:opacity-90 transition-all disabled:opacity-70 flex items-center gap-2 shadow-sm">
                                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} 
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* 2. ADMIN ROLE CONTROLS (Only if Admin Viewing Other) */}
                {isAdminView && (
                    <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
                        <div className="p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-white/10">
                                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg"><Sparkles size={18}/></div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Workspace Role</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Manage access permissions for this user</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block">System Role</label>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <select value={role} onChange={(e) => setRole(e.target.value)} className="flex-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#1A1A1A] px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-sm cursor-pointer">
                                        <option value="viewer">Viewer (Read Only)</option>
                                        <option value="editor">Editor (Upload & Edit)</option>
                                        <option value="admin">Admin (Full Access)</option>
                                    </select>
                                    <button onClick={handleAdminRoleUpdate} disabled={isSaving || role === profileData.role} className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-sm">
                                        Update Role
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. DANGER ZONE (Separated into its own card for Vercel-style UI) */}
                {isAdminView && (
                    <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-red-200 dark:border-red-900/50 overflow-hidden">
                        <div className="p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg"><AlertTriangle size={18}/></div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Danger Zone</h2>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-200">Delete this user</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                                        Permanently remove <strong>{profileData.name}</strong> from the workspace. All their uploaded assets and collections will be deleted.
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setIsDeleteModalOpen(true)}
                                    className="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 font-medium text-sm rounded-lg transition-colors border border-red-200 dark:border-red-900/50"
                                >
                                    Delete User
                                </button>
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
        title="Delete User"
        message={`Are you sure you want to permanently delete ${profileData?.name}? This action will wipe all their data and cannot be undone.`}
        confirmText="Yes, Delete User"
        isDangerous={true}
        isLoading={isDeleting}
      />

    </div>
  );
};

export default Profile;