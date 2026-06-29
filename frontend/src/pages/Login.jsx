import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', { email, password });
      login(res.data.user, res.data.token);

      // Route users natively based on Role matrices
      const role = res.data.user.role;
      if (role === 'Admin') navigate('/admin');
      else if (role === 'Responder') navigate('/responder');
      else navigate('/report');
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication channel failure.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight">
            ResQNet Portal
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Secure Emergency Coordination Framework
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email Address</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              placeholder="operator@resqnet.org"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Security Password</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold p-3 rounded-lg transition duration-150 text-sm tracking-wide shadow-md shadow-red-200"
          >
            {loading ? 'Validating Security Mesh...' : 'SIGN IN TO NETWORK'}
          </button>
        </form>
      </div>
    </div>
  );
}