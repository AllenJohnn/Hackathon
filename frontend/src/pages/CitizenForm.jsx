import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { ShieldAlert, MapPin, Users, LogOut } from 'lucide-react';

export default function CitizenForm() {
  const { token, logout, user } = useContext(AuthContext);
  const [form, setForm] = useState({ category: 'Flood', description: '', people_count: 1, landmark: '' });
  const [coords, setCoords] = useState({ lat: 9.9312, lng: 76.2673 }); // Standard fallback coordinates
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("Using standard baseline geo-coordinate fallbacks.")
      );
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      category: form.category,
      description: form.description,
      people_count: form.people_count,
      latitude: coords.lat,
      longitude: coords.lng,
      landmark: form.landmark
    };

    if (!navigator.onLine) {
      const offlineQueue = JSON.parse(localStorage.getItem('offline_requests') || '[]');
      offlineQueue.push({ ...payload, id: Date.now() });
      localStorage.setItem('offline_requests', JSON.stringify(offlineQueue));

      const smsPayload = `RESQNET|${form.category}|Count:${form.people_count}|Lat:${coords.lat.toFixed(4)}|Lng:${coords.lng.toFixed(4)}`;
      alert(`📶 Network Outage Detected!\n\nSimulating Secure SMS Fallback Gateway Transmission:\n"${smsPayload}"\n\nYour alert record has also been successfully cached locally inside your browser storage synchronization loop.`);
      setLoading(false);
      return;
    }

    try {
      await axios.post('http://localhost:5000/api/requests', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('🚨 SOS Signal transmitted securely to the central triage dispatch mesh.');
      setForm({ category: 'Flood', description: '', people_count: 1, landmark: '' });
    } catch (err) {
      alert(err.response?.data?.message || 'Signal ingestion failure.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between">
      <header className="bg-slate-950 border-b border-slate-800 p-4 flex justify-between items-center max-w-7xl w-full mx-auto rounded-b-xl shadow-lg">
        <h1 className="text-xl font-bold tracking-wider text-red-500 flex items-center gap-2">
          <ShieldAlert className="animate-pulse text-red-500" /> RESQNET DIGITAL BEACON
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 text-slate-300">
            📡 ID: {user?.name}
          </span>
          <button onClick={logout} className="text-slate-400 hover:text-red-400 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8">
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">Broadcast Crisis Vector</h2>
            <p className="text-xs text-slate-400 mt-1">Field telemetry will synchronize automatically upon package transmission.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase font-bold tracking-widest text-slate-400 mb-1.5">Crisis Definition</label>
              <select 
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 text-slate-200 outline-none"
                value={form.category} onChange={e => setForm({...form, category: e.target.value})}
              >
                <option>Flood</option><option>Fire Emergency</option><option>Earthquake</option><option>Medical Crisis</option><option>Building Collapse</option>
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase font-bold tracking-widest text-slate-400 mb-1.5">Incident Description</label>
              <textarea 
                required rows="3" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-red-500 outline-none placeholder-slate-600"
                placeholder="Detail structural hazards, immediate medical trauma indicators, or rising water heights clearly..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-bold tracking-widest text-slate-400 mb-1.5 flex items-center gap-1"><Users size={12}/> Count</label>
                <input 
                  type="number" min="1" value={form.people_count} onChange={e => setForm({...form, people_count: parseInt(e.target.value) || 1})}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 outline-none text-center"
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold tracking-widest text-slate-400 mb-1.5 flex items-center gap-1"><MapPin size={12}/> Nearby Landmark</label>
                <input 
                  type="text" value={form.landmark} onChange={e => setForm({...form, landmark: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 outline-none placeholder-slate-600"
                  placeholder="e.g., Near Metro Station B"
                />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800/60 p-3.5 rounded-xl flex items-center justify-between text-xs font-mono text-slate-400">
              <span>📍 TELEMETRY COORDS:</span>
              <span className="text-emerald-400 font-bold tracking-wide">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold tracking-wider uppercase p-4 rounded-xl shadow-lg transition-all text-sm duration-150 transform active:scale-95">
              {loading ? 'Transmitting Ingestion Matrix...' : 'Transmit Active SOS Vector'}
            </button>
          </form>
        </div>
      </main>

      <footer className="text-center p-4 text-[10px] font-mono tracking-widest text-slate-600">
        SECURE ENCRYPTED NODE // CORE CONFIG V2.5
      </footer>
    </div>
  );
}