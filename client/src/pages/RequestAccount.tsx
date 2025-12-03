import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { UserPlus, ArrowLeft, Loader2 } from 'lucide-react';

const RequestAccount = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // The backend creates the user with status: 'PENDING'
      await client.post('/auth/register', { email, password, name });
      
      // Success Feedback
      alert('Request Sent Successfully!\n\nAn administrator must approve your account before you can log in.');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <UserPlus size={24} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Request Access</h2>
          <p className="mt-2 text-sm text-gray-500">
            Join the workspace. Your account will need approval from an admin.
          </p>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500 outline-none transition-all"
              placeholder="e.g. Jane Doe"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500 outline-none transition-all"
              placeholder="jane@company.com"
              required
            />
          </div>
          
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500 outline-none transition-all"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-70 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                Sending Request...
              </>
            ) : (
              'Submit Request'
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center">
          <Link 
            to="/login" 
            className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-blue-600"
          >
            <ArrowLeft size={16} className="mr-1" />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RequestAccount;