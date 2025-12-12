import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { toast } from 'react-toastify';
import { 
    User, Camera, Loader2, Mail, Shield, Check, 
    ArrowLeft, Sparkles, HardDrive, Folder, Trash2, Calendar
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const Profile = () => {
  const { user: currentUser, login } = useAuth();
  const { id } = useParams(); // Get ID from URL (if any)
  const navigate = useNavigate();

  // LOGIC: If no ID is in URL, or ID matches me, it's MY profile.
  const isOwnProfile = !id || (currentUser && id === currentUser.id);
  const isAdminView = currentUser?.role === 'admin' && !isOwnProfile;

  // State
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit Form State (For Own Profile)
  const [name, setName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin Actions State (For Viewing Others)
  const [role, setRole] = useState('');

  // --- 1. FETCH DATA ---
  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        try {
            if (isOwnProfile) {
                // LOAD ME: Use context data
                setProfileData(currentUser);
                setName(currentUser?.name || '');
                setAvatarPreview(currentUser?.avatar || null);
            } else {
                // LOAD THEM: Fetch from API (requires the getUserById endpoint we made)
                const { data } = await client.get(`/users/${id}`);
                setProfileData(data);
                setName(data.name);
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

  // Action: Update My Profile
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

          // Update Context
          const token = localStorage.getItem('token') || '';
          login(token, updatedUser);
          toast.success("Profile updated!");
          setAvatarFile(null);
      } catch (error) { toast.error("Failed to update profile"); } 
      finally { setIsSaving(false); }
  };

  // Action: Admin Update Role
  const handleAdminRoleUpdate = async () => {
      if (!profileData || isSaving) return;
      setIsSaving(true);
      try {
          await client.patch(`/users/${profileData.id}/role`, { role });
          toast.success("User role updated");
      } catch (e) { toast.error("Failed to update role"); }
      finally { setIsSaving(false); }
  };

  // Action: Admin Delete User
  const handleAdminDelete = async () => {
      if (!confirm("Permanently delete this user?")) return;
      try {
          await client.delete(`/users/${profileData.id}`);
          toast.success("User deleted");
          navigate('/users');
      } catch (e) { toast.error("Failed to delete"); }
  };

  if (isLoading || !profileData) return <div className="flex h-screen items-center justify-center dark:bg-[#0B0D0F]"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0D0F] transition-colors duration-500 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        <button onClick={() => navigate(-1)} className="group mb-6 flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium text-sm">
            <div className="p-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 group-hover:border-blue-200 transition-colors shadow-sm"><ArrowLeft size={16} /></div>
            {isAdminView ? 'Back to Users' : 'Back'}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* --- LEFT COLUMN: IDENTITY CARD --- */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-[#1A1D21] rounded-3xl shadow-sm border border-gray-200 dark:border-white/5 overflow-hidden p-6 text-center">
                    
                    {/* Avatar */}
                    <div className="relative inline-block mb-4 group">
                        <div className="h-32 w-32 rounded-full border-4 border-gray-50 dark:border-white/5 bg-gray-100 dark:bg-black overflow-hidden mx-auto flex items-center justify-center shadow-lg">
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-4xl font-bold text-gray-400">{profileData.name?.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        {/* Camera Icon (Only for Self) */}
                        {isOwnProfile && (
                            <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2.5 bg-blue-600 text-white rounded-full shadow-lg hover:scale-110 transition-transform border-4 border-white dark:border-[#1A1D21]">
                                <Camera size={16} />
                            </button>
                        )}
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{profileData.name}</h1>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-4">
                        <Shield size={12} /> {profileData.role}
                    </div>

                    <div className="text-sm text-gray-500 dark:text-gray-400 space-y-2 border-t border-gray-100 dark:border-white/5 pt-4">
                        <div className="flex items-center justify-center gap-2"><Mail size={14}/> {profileData.email}</div>
                        {profileData.createdAt && (
                            <div className="flex items-center justify-center gap-2"><Calendar size={14}/> Joined {new Date(profileData.createdAt).toLocaleDateString()}</div>
                        )}
                    </div>
                </div>

                {/* Stats Card (Visible if data exists) */}
                {profileData._count && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-[#1A1D21] p-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm text-center">
                            <div className="mx-auto w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center mb-2"><HardDrive size={20}/></div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">{profileData._count.assets}</div>
                            <div className="text-xs text-gray-500">Uploads</div>
                        </div>
                        <div className="bg-white dark:bg-[#1A1D21] p-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm text-center">
                            <div className="mx-auto w-10 h-10 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center mb-2"><Folder size={20}/></div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">{profileData._count.collections}</div>
                            <div className="text-xs text-gray-500">Collections</div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- RIGHT COLUMN: FORMS & ACTIONS --- */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* 1. EDIT PROFILE FORM (Only if Self) */}
                {isOwnProfile && (
                    <div className="bg-white dark:bg-[#1A1D21] rounded-3xl shadow-sm border border-gray-200 dark:border-white/5 p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-lg"><User size={20}/></div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Profile Settings</h2>
                        </div>
                        
                        <form onSubmit={handleSelfUpdate} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Display Name</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" />
                            </div>
                            <div className="space-y-2 opacity-60">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Email</label>
                                <input type="email" value={profileData.email} disabled className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-500 cursor-not-allowed" />
                            </div>
                            <div className="pt-4">
                                <button type="submit" disabled={isSaving} className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-70 flex items-center gap-2">
                                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} Save Changes
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
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Admin Controls</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Change Role</label>
                                <div className="flex gap-2">
                                    <select value={role} onChange={(e) => setRole(e.target.value)} className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none focus:border-orange-500">
                                        <option value="viewer">Viewer</option>
                                        <option value="editor">Editor</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                    <button onClick={handleAdminRoleUpdate} disabled={isSaving || role === profileData.role} className="px-4 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors">
                                        Update
                                    </button>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-gray-100 dark:border-white/5">
                                <h3 className="text-sm font-bold text-red-600 mb-2">Danger Zone</h3>
                                <p className="text-xs text-gray-500 mb-4">Deleting a user will permanently remove all their assets and collections.</p>
                                <button onClick={handleAdminDelete} className="w-full py-3 border-2 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-2">
                                    <Trash2 size={18} /> Delete User
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;