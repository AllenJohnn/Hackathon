import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegistering) {
        await axios.post('http://localhost:5000/api/auth/register', { name, email, phone, password });
        alert('Registration successful! You can now sign in with your credentials.');
        setIsRegistering(false);
        setPassword('');
      } else {
        const res = await axios.post('http://localhost:5000/api/auth/login', { email, password });
        login(res.data.user, res.data.token);

        const role = res.data.user.role;
        if (role === 'Admin') navigate('/admin');
        else if (role === 'Responder') navigate('/responder');
        else navigate('/report');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication channel failure.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-center text-2xl font-bold text-slate-900 tracking-tight">
            {isRegistering ? 'Register SOS Account' : 'ResQNet Portal'}
          </h2>
          <p className="mt-2 text-center text-xs text-slate-500">
            {isRegistering ? (
              <span>Already registered? <button type="button" onClick={() => { setIsRegistering(false); setError(''); }} className="text-indigo-600 hover:underline font-semibold outline-none">Sign In</button></span>
            ) : (
              <span>Need a citizen account? <button type="button" onClick={() => { setIsRegistering(true); setError(''); }} className="text-indigo-600 hover:underline font-semibold outline-none">Register Account</button></span>
            )}
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-xs text-red-700">
            ⚠️ {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isRegistering && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600">Full Name</label>
                <input
                  type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:border-slate-400 outline-none"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600">Phone Number</label>
                <input
                  type="text" required value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:border-slate-400 outline-none"
                  placeholder="9876543210"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600">Email Address</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:border-slate-400 outline-none"
              placeholder="e.g. citizen@resqnet.org"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">Security Password</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:border-slate-400 outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium p-3 rounded-lg transition duration-150 text-xs tracking-wider uppercase shadow-sm"
          >
            {loading ? 'Validating Network Security...' : isRegistering ? 'Create Citizen Account' : 'SIGN IN TO PORTAL'}
          </button>
        </form>
      </div>
    </div>
  );
}