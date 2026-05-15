import React, { useState, useEffect, useRef } from 'react';
import { Copy, Server, Plus, Trash2, X, Info, HardDrive, ShieldAlert, FileText, Cpu, Network, DollarSign, Activity, UploadCloud, Download, Edit2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import client from '../api/client';

const initialFormState = {
  name: '', provider: 'Hetzner', project: '', owner: '',
  ip: '', vcpu: '', ram: '', disk: '',
  services: '', monthlyCost: '', backup: '', notes: ''
};

const AUTHORIZED_NAMES = ['perdausi', 'abraham', 'raffee', 'june', 'damian', 'jason'];

export default function AdminInfrastructure() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false, title: '', message: '', confirmText: '', isDanger: true, action: () => {}
  });

  const [isCredAuth, setIsCredAuth] = useState(false);
  const [showCredAuthPrompt, setShowCredAuthPrompt] = useState(false);
  const [credNameInput, setCredNameInput] = useState('');
  const [showManageCreds, setShowManageCreds] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    try {
      const res = await client.get('/infrastructure');
      setNodes(res.data);
    } catch (error) {
      toast.error("Failed to load vault data", { theme: "dark" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!", { theme: "dark" });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditId(null);
    setFormData(initialFormState);
    setShowFormModal(true);
  };

  const openEditModal = (node: any) => {
    setIsEditing(true);
    setEditId(node.id);
    setFormData({ ...node, monthlyCost: node.monthlyCost ? node.monthlyCost.toString() : '' });
    setShowFormModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { ...formData, monthlyCost: formData.monthlyCost ? parseFloat(formData.monthlyCost as string) : 0 };
      if (isEditing && editId) {
        await client.put(`/infrastructure/${editId}`, payload);
        toast.success("Server updated!", { theme: "dark" });
        if (selectedNode?.id === editId) setSelectedNode({ ...selectedNode, ...payload });
      } else {
        await client.post('/infrastructure', payload);
        toast.success("Server added!", { theme: "dark" });
      }
      setShowFormModal(false);
      fetchNodes(); 
    } catch (error) {
      toast.error("Failed to save data.", { theme: "dark" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDeleteServer = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Destroy Instance Data?",
      message: "This will permanently remove the server and its stored credentials from the CapyDAM vault.",
      confirmText: "Yes, Delete Server",
      isDanger: true,
      action: async () => {
        try {
          await client.delete(`/infrastructure/${id}`);
          toast.success("Server removed.", { theme: "dark" });
          setSelectedNode(null); 
          fetchNodes();
        } catch (error) {
          toast.error("Failed to delete.", { theme: "dark" });
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = credNameInput.toLowerCase().trim();
    if (AUTHORIZED_NAMES.includes(cleanInput)) {
        setIsCredAuth(true);
        setShowCredAuthPrompt(false);
        setShowManageCreds(true);
        setCredNameInput('');
        toast.success(`Access granted, welcome ${cleanInput}.`, { theme: "dark" });
    } else {
        toast.error("Access Denied: Unrecognized authority.", { theme: "dark" });
    }
  };

  // ✅ NEW: Real File Upload using FormData
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = new FormData();
    data.append('keyFile', file);

    const toastId = toast.loading("Securing file to vault...", { theme: "dark" });

    try {
        const res = await client.post(`/infrastructure/${selectedNode.id}/key`, data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.update(toastId, { render: "File securely uploaded!", type: "success", isLoading: false, autoClose: 3000 });
        
        setSelectedNode(res.data);
        setNodes(nodes.map(n => n.id === res.data.id ? res.data : n));
    } catch (err) {
        toast.update(toastId, { render: "Failed to upload file.", type: "error", isLoading: false, autoClose: 3000 });
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const requestRemoveCredentials = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Secured File?",
      message: `Are you sure you want to permanently delete ${selectedNode.sshKeyFileName || 'this file'} from the vault?`,
      confirmText: "Delete File",
      isDanger: true,
      action: async () => {
        try {
          const res = await client.delete(`/infrastructure/${selectedNode.id}/key`);
          toast.success("File wiped from vault.", { theme: "dark" });
          setSelectedNode(res.data);
          setNodes(nodes.map(n => n.id === res.data.id ? res.data : n));
        } catch (err) {
          toast.error("Failed to delete file.", { theme: "dark" });
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // ✅ Download exact file content using the real filename stored in DB
  const downloadPPK = () => {
    if (!selectedNode?.sshKey) return;
    const blob = new Blob([selectedNode.sshKey], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedNode.sshKeyFileName || `${selectedNode.name.replace(/\s+/g, '_')}_key.ppk`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("File downloaded successfully.", { theme: "dark" });
  };

  if (loading) return <div className="p-8 text-white flex items-center justify-center min-h-[50vh]">Loading Command Center...</div>;

  return (
    <div className="p-8 max-w-[1400px] mx-auto relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Server className="text-[#2ecfa3]" size={32} />
            Infrastructure Vault
          </h1>
          <p className="text-[#8590a8] mt-2 font-mono text-sm uppercase tracking-widest">
            Secure Server Fleet Command & Control
          </p>
        </div>
        <button onClick={openAddModal} className="bg-[#2ecfa3]/10 text-[#2ecfa3] border border-[#2ecfa3]/30 hover:bg-[#2ecfa3]/20 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all">
          <Plus size={18} /> Add Server
        </button>
      </div>

      <div className="bg-[#0d1018] border border-white/5 rounded-2xl shadow-lg overflow-hidden mb-12">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#131722] border-b border-white/5 text-[#8590a8] font-mono text-xs uppercase tracking-wider">
              <th className="p-5 font-medium">Server Identity</th>
              <th className="p-5 font-medium">IP Address</th>
              <th className="p-5 font-medium">Owner</th>
              <th className="p-5 font-medium">Monthly Cost</th>
              <th className="p-5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {nodes.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-[#8590a8]">No servers registered.</td></tr>
            ) : (
              nodes.map((node) => (
                <tr key={node.id} className="hover:bg-[#131722]/50 transition-colors group">
                  <td className="p-5">
                    <div className="font-semibold text-white text-base">{node.name}</div>
                    <div className="text-[10px] text-[#8590a8] uppercase font-mono mt-1">{node.provider} {node.project && `• ${node.project}`}</div>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[#dde2ed]">{node.ip || '--'}</span>
                      {node.ip && <button onClick={() => copyToClipboard(node.ip)} className="text-[#8590a8] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><Copy size={14} /></button>}
                    </div>
                  </td>
                  <td className="p-5 text-[#dde2ed]">{node.owner || '--'}</td>
                  <td className="p-5 font-mono text-[#2ecfa3] font-medium">{node.monthlyCost ? `€${node.monthlyCost.toFixed(2)}` : '--'}</td>
                  <td className="p-5 text-right flex items-center justify-end gap-2">
                      <button onClick={() => openEditModal(node)} className="bg-white/5 hover:bg-white/10 text-white border border-white/10 p-2 rounded-lg transition-all" title="Edit"><Edit2 size={16}/></button>
                      <button onClick={() => setSelectedNode(node)} className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all"><Info size={14}/> View Details</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedNode && (
        <div className="fixed inset-0 z-[90] bg-[#05070c]/90 backdrop-blur-md flex justify-center items-center p-4 lg:p-8">
          <div className="w-[95vw] max-w-[1600px] bg-[#07090e] border border-white/10 rounded-[2rem] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/5 flex items-start justify-between bg-white/[0.02] shrink-0">
               <div>
                  <h2 className="text-3xl font-extrabold text-white flex items-center gap-3"><Server className="text-[#2ecfa3]" size={32}/> {selectedNode.name}</h2>
                  <div className="flex items-center gap-3 mt-2 font-mono text-xs text-[#8590a8] uppercase tracking-wider">
                     <span className="bg-white/5 px-3 py-1 rounded-full">{selectedNode.provider}</span>
                     <span>Project: {selectedNode.project || 'N/A'}</span>
                     <span>•</span>
                     <span>Owner: {selectedNode.owner || 'Unassigned'}</span>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <button onClick={() => openEditModal(selectedNode)} className="flex items-center gap-2 text-white bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl transition-colors font-semibold text-sm border border-white/5"><Edit2 size={16} /> Edit Data</button>
                  <button onClick={() => setSelectedNode(null)} className="text-[#8590a8] hover:text-white hover:bg-white/10 p-2.5 rounded-xl transition-colors border border-transparent"><X size={24} /></button>
               </div>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 auto-rows-min">
                
                <div className="lg:col-span-1 bg-[#0d1018] border border-white/5 rounded-3xl p-6 flex flex-col justify-center relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Network size={80}/></div>
                   <div className="text-xs text-[#8590a8] uppercase font-mono mb-2 relative z-10">Public IP Address</div>
                   <div className="flex items-center justify-between relative z-10">
                      <span className="font-mono text-white text-2xl font-semibold tracking-tight">{selectedNode.ip || '--'}</span>
                      <button onClick={() => copyToClipboard(selectedNode.ip)} className="text-[#8590a8] hover:text-white p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all"><Copy size={20}/></button>
                   </div>
                </div>

                <div className="lg:col-span-2 bg-[#0d1018] border border-[#2ecfa3]/20 rounded-3xl p-6 relative overflow-hidden">
                   <div className="flex items-center gap-2 text-sm font-bold text-[#2ecfa3] mb-4"><Activity size={18}/> Hosted Services</div>
                   {selectedNode.services ? (
                      <div className="flex flex-wrap gap-2.5">
                        {selectedNode.services.split(',').map((service: string, i: number) => (
                           <span key={i} className="bg-[#2ecfa3]/10 border border-[#2ecfa3]/30 text-[#2ecfa3] px-4 py-2 rounded-xl text-sm font-medium">{service.trim()}</span>
                        ))}
                      </div>
                   ) : <p className="text-[#8590a8] italic">No active services documented.</p>}
                </div>

                <div className="lg:col-span-1 lg:row-span-2 bg-gradient-to-b from-[#131722] to-[#0d1018] border border-white/5 rounded-3xl p-6 flex flex-col justify-between">
                   <div>
                     <div className="flex items-center gap-2 text-sm font-bold text-white mb-6"><Cpu size={18} className="text-[#8590a8]"/> Hardware Specs</div>
                     <div className="space-y-5">
                        <div className="bg-white/5 p-4 rounded-2xl"><span className="block text-[11px] text-[#8590a8] font-mono uppercase mb-1">Processors (vCPU)</span><span className="text-white font-mono text-xl font-semibold">{selectedNode.vcpu || '--'}</span></div>
                        <div className="bg-white/5 p-4 rounded-2xl"><span className="block text-[11px] text-[#8590a8] font-mono uppercase mb-1">Memory (RAM)</span><span className="text-white font-mono text-xl font-semibold">{selectedNode.ram || '--'}</span></div>
                        <div className="bg-white/5 p-4 rounded-2xl"><span className="block text-[11px] text-[#8590a8] font-mono uppercase mb-1">Storage Array</span><span className="text-white font-mono text-xl font-semibold">{selectedNode.disk || '--'}</span></div>
                     </div>
                   </div>
                   <div className="mt-6 pt-6 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#8590a8] font-mono uppercase flex items-center gap-1"><DollarSign size={14}/> Monthly Cost</span>
                        <span className="font-mono text-[#2ecfa3] text-2xl font-bold">{selectedNode.monthlyCost ? `€${selectedNode.monthlyCost.toFixed(2)}` : '--'}</span>
                      </div>
                   </div>
                </div>

                <div className="lg:col-span-1 bg-gradient-to-br from-[#ef5656]/10 to-[#0d1018] border border-[#ef5656]/30 rounded-3xl p-6 flex flex-col justify-center items-center text-center">
                   <ShieldAlert size={36} className="text-[#ef5656] mb-3" />
                   <h3 className="text-base font-bold text-white mb-1">Vault Credentials</h3>
                   <p className="text-xs text-[#8590a8] mb-5">
                     {selectedNode.sshKeyFileName ? `Secured: ${selectedNode.sshKeyFileName}` : "No file installed."}
                   </p>
                   <button onClick={() => { isCredAuth ? setShowManageCreds(true) : setShowCredAuthPrompt(true); }} className="bg-[#ef5656] hover:bg-[#d64c4c] text-white px-5 py-3 rounded-xl text-sm font-bold transition-all w-full shadow-lg shadow-[#ef5656]/20">
                     Manage Access
                   </button>
                </div>

                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0d1018] border border-white/5 rounded-3xl p-6">
                   <div>
                      <div className="flex items-center gap-2 text-sm font-bold text-white mb-3"><HardDrive size={18} className="text-[#8590a8]"/> Backup Strategy</div>
                      <p className="text-sm text-[#8590a8] leading-relaxed">{selectedNode.backup || '--'}</p>
                   </div>
                   <div className="md:border-l md:border-white/10 md:pl-6">
                      <div className="flex items-center gap-2 text-sm font-bold text-white mb-3"><FileText size={18} className="text-[#8590a8]"/> System Notes</div>
                      <p className="text-sm text-[#dde2ed] whitespace-pre-wrap leading-relaxed">{selectedNode.notes || '--'}</p>
                   </div>
                </div>

              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-[#0a0c12] shrink-0 flex justify-between items-center rounded-b-[2rem]">
               <button onClick={() => requestDeleteServer(selectedNode.id)} className="text-[#ef5656] hover:bg-[#ef5656]/10 border border-transparent hover:border-[#ef5656]/20 px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"><Trash2 size={18}/> Destroy Instance Data</button>
               <button onClick={() => setSelectedNode(null)} className="px-8 py-3 rounded-xl font-bold text-white bg-white/5 hover:bg-white/10 transition-colors">Close View</button>
            </div>

          </div>
        </div>
      )}

      {/* AUTH PROMPT */}
      {showCredAuthPrompt && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex justify-center items-center p-4">
           <div className="bg-[#0d1018] border border-[#ef5656]/40 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><ShieldAlert className="text-[#ef5656]" size={24}/> Identity Check</h3>
              <p className="text-sm text-[#8590a8] mb-5">Please enter your authorized vault name to access instance credentials.</p>
              <form onSubmit={handleAuthSubmit}>
                 <input type="password" autoFocus placeholder="Enter Name..." value={credNameInput} onChange={e => setCredNameInput(e.target.value)} className="w-full bg-[#131722] border border-white/10 rounded-xl px-4 py-3 text-white font-mono outline-none focus:border-[#ef5656]/50 transition-colors mb-5 shadow-inner" />
                 <div className="flex gap-3 justify-end">
                    <button type="button" onClick={() => setShowCredAuthPrompt(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-[#8590a8] hover:text-white bg-white/5 hover:bg-white/10 transition-colors">Cancel</button>
                    <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[#ef5656] text-white hover:bg-[#d64c4c] transition-colors shadow-lg shadow-[#ef5656]/20">Verify</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* FILE MANAGER UI */}
      {showManageCreds && selectedNode && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex justify-center items-center p-4">
           <div className="bg-[#0d1018] border border-[#2ecfa3]/40 rounded-2xl w-full max-w-md p-8 shadow-2xl">
              
              <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4">
                 <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><FileText className="text-[#2ecfa3]"/> Vault File Manager</h3>
                    <p className="text-xs text-[#8590a8] mt-1 font-mono">{selectedNode.name} Credentials</p>
                 </div>
                 <button onClick={() => setShowManageCreds(false)} className="text-[#8590a8] hover:text-white bg-white/5 p-2 rounded-lg"><X size={20}/></button>
              </div>

              {selectedNode.sshKeyFileName ? (
                  <div className="bg-[#131722] rounded-xl p-5 border border-[#2ecfa3]/30 mb-6 shadow-inner flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="bg-[#2ecfa3]/10 p-3 rounded-lg text-[#2ecfa3]"><FileText size={24}/></div>
                        <div>
                           <p className="text-sm font-bold text-white">{selectedNode.sshKeyFileName}</p>
                           <p className="text-xs text-[#8590a8] flex items-center gap-1 mt-0.5"><ShieldAlert size={10}/> Secured in Database</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <button onClick={downloadPPK} className="p-2.5 bg-[#2ecfa3]/10 hover:bg-[#2ecfa3]/20 text-[#2ecfa3] rounded-lg transition-colors" title="Download File"><Download size={18}/></button>
                        <button onClick={requestRemoveCredentials} className="p-2.5 bg-[#ef5656]/10 hover:bg-[#ef5656]/20 text-[#ef5656] rounded-lg transition-colors" title="Delete File"><Trash2 size={18}/></button>
                     </div>
                  </div>
              ) : (
                  <div className="bg-[#131722] rounded-xl p-6 border border-dashed border-white/20 mb-6 text-center">
                     <UploadCloud className="mx-auto text-[#8590a8] mb-3" size={32}/>
                     <p className="text-sm font-bold text-white mb-1">No file installed</p>
                     <p className="text-xs text-[#8590a8]">Upload a .ppk or .pem file to secure it in the database.</p>
                  </div>
              )}

              <input type="file" accept=".ppk,.pem,.txt" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-3.5 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2">
                 <UploadCloud size={18}/> {selectedNode.sshKeyFileName ? "Replace File" : "Upload File"}
              </button>
           </div>
        </div>
      )}

      {/* FORM MODAL */}
      {showFormModal && (
        // Same form UI as before, just updated header to say "Edit" when editing
        <div className="fixed inset-0 z-[100] bg-[#05070c]/90 backdrop-blur-md flex justify-center items-center p-4">
          <div className="w-full max-w-3xl bg-[#0d1018] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2"><Server className="text-[#2ecfa3]" size={20}/> {isEditing ? "Edit Server Configuration" : "Register New Server"}</h2>
                <p className="text-sm text-[#8590a8] mt-1 font-mono">{isEditing ? "Update instance data below" : "Add an instance to the secure vault"}</p>
              </div>
              <button onClick={() => setShowFormModal(false)} className="text-[#8590a8] hover:text-white bg-[#131722] p-2 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form id="server-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-mono text-[#8590a8] mb-1.5 uppercase">Server Name *</label><input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full bg-[#131722] border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-[#2ecfa3]/50" /></div>
                  <div><label className="block text-xs font-mono text-[#8590a8] mb-1.5 uppercase">Hetzner Project</label><input type="text" name="project" value={formData.project} onChange={handleInputChange} className="w-full bg-[#131722] border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-[#2ecfa3]/50" /></div>
                  <div><label className="block text-xs font-mono text-[#8590a8] mb-1.5 uppercase">Main Owner</label><input type="text" name="owner" value={formData.owner} onChange={handleInputChange} className="w-full bg-[#131722] border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-[#2ecfa3]/50" /></div>
                  <div><label className="block text-xs font-mono text-[#8590a8] mb-1.5 uppercase">IP Address</label><input type="text" name="ip" value={formData.ip} onChange={handleInputChange} className="w-full bg-[#131722] border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-[#2ecfa3]/50 font-mono" /></div>
                </div>
                <hr className="border-white/5" />
                <div className="grid grid-cols-4 gap-4">
                  <div><label className="block text-xs font-mono text-[#8590a8] mb-1.5 uppercase">vCPU</label><input type="text" name="vcpu" value={formData.vcpu} onChange={handleInputChange} className="w-full bg-[#131722] border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-[#2ecfa3]/50 text-sm" /></div>
                  <div><label className="block text-xs font-mono text-[#8590a8] mb-1.5 uppercase">RAM</label><input type="text" name="ram" value={formData.ram} onChange={handleInputChange} className="w-full bg-[#131722] border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-[#2ecfa3]/50 text-sm" /></div>
                  <div><label className="block text-xs font-mono text-[#8590a8] mb-1.5 uppercase">Disk</label><input type="text" name="disk" value={formData.disk} onChange={handleInputChange} className="w-full bg-[#131722] border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-[#2ecfa3]/50 text-sm" /></div>
                  <div><label className="block text-xs font-mono text-[#8590a8] mb-1.5 uppercase">Cost (€/mo)</label><input type="number" step="0.01" name="monthlyCost" value={formData.monthlyCost} onChange={handleInputChange} className="w-full bg-[#131722] border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-[#2ecfa3]/50 text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-mono text-[#8590a8] mb-1.5 uppercase">Services (Comma Separated)</label><input type="text" name="services" value={formData.services} onChange={handleInputChange} className="w-full bg-[#131722] border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-[#2ecfa3]/50" /></div>
                  <div><label className="block text-xs font-mono text-[#8590a8] mb-1.5 uppercase">Backup Strategy</label><input type="text" name="backup" value={formData.backup} onChange={handleInputChange} className="w-full bg-[#131722] border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-[#2ecfa3]/50" /></div>
                </div>
                <hr className="border-white/5" />
                {!isEditing && (
                  <div>
                    <label className="block text-xs font-mono text-[#ef5656] mb-1.5 uppercase font-bold flex items-center gap-2">SSH Keys / Credentials</label>
                    <div className="w-full bg-[#131722] border border-[#ef5656]/30 rounded-lg px-4 py-3 text-[#8590a8] font-mono text-sm">
                      ⚠️ Please register the server first. You can securely upload the .ppk file later from the Server Details panel.
                    </div>
                  </div>
                )}
                <div><label className="block text-xs font-mono text-[#8590a8] mb-1.5 uppercase">Notes</label><textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={2} className="w-full bg-[#131722] border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-[#2ecfa3]/50 custom-scrollbar" /></div>
              </form>
            </div>
            <div className="p-6 border-t border-white/5 bg-[#07090e] shrink-0 flex justify-end gap-3 rounded-b-2xl">
              <button type="button" onClick={() => setShowFormModal(false)} className="px-5 py-2.5 rounded-lg font-semibold text-white hover:bg-white/5 transition-colors">Cancel</button>
              <button type="submit" form="server-form" disabled={isSubmitting} className="bg-[#2ecfa3] text-black px-6 py-2.5 rounded-lg font-bold hover:bg-[#25b58d] transition-all flex items-center gap-2 disabled:opacity-50">
                {isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Register Server')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION OVERLAY */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex justify-center items-center p-4">
           <div className={`bg-[#0d1018] border ${confirmDialog.isDanger ? 'border-[#ef5656]/40' : 'border-[#2ecfa3]/40'} rounded-2xl w-full max-w-sm p-6 shadow-2xl`}>
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                 {confirmDialog.isDanger ? <AlertTriangle className="text-[#ef5656]" size={24}/> : <Info className="text-[#2ecfa3]" size={24}/>} {confirmDialog.title}
              </h3>
              <p className="text-sm text-[#8590a8] mb-6 leading-relaxed">{confirmDialog.message}</p>
              <div className="flex gap-3 justify-end">
                 <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="px-5 py-2.5 rounded-xl text-sm font-bold text-[#8590a8] hover:text-white bg-white/5 hover:bg-white/10 transition-colors">Cancel</button>
                 <button onClick={confirmDialog.action} className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg ${confirmDialog.isDanger ? 'bg-[#ef5656] hover:bg-[#d64c4c] shadow-[#ef5656]/20' : 'bg-[#2ecfa3] text-black hover:bg-[#25b58d] shadow-[#2ecfa3]/20'}`}>
                   {confirmDialog.confirmText}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}