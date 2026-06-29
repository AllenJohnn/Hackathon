import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { ShieldAlert, MapPin, Users, LogOut } from 'lucide-react';

export default function CitizenForm() {
  const { token, logout, user } = useContext(AuthContext);
  const [form, setForm] = useState({ category: 'Flood', description: '', people_count: 1, landmark: '' });
  const [coords, setCoords] = useState({ lat: 9.9312, lng: 76.2673 }); // Standard fallback coordinates
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [myRequests, setMyRequests] = useState([]);

  const fetchMyRequests = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyRequests(res.data);
    } catch (err) {
      console.error('Failed to capture active distress requests logs.', err);
    }
  };

  const syncOfflineRequests = async () => {
    if (!navigator.onLine) return;
    const offlineQueue = JSON.parse(localStorage.getItem('offline_requests') || '[]');
    if (offlineQueue.length === 0) return;

    console.log(`Syncing ${offlineQueue.length} offline requests...`);
    const remainingQueue = [];

    for (const req of offlineQueue) {
      try {
        const { id, ...payload } = req; // Strip local temp ID
        await axios.post('http://localhost:5000/api/requests', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Failed to sync offline request:', err);
        remainingQueue.push(req); // Keep it to retry later
      }
    }

    localStorage.setItem('offline_requests', JSON.stringify(remainingQueue));
    if (remainingQueue.length === 0) {
      alert('🔄 All cached offline emergency reports have been successfully synchronized with the central triage gateway.');
      fetchMyRequests();
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("Using standard baseline geo-coordinate fallbacks.")
      );
    }

    syncOfflineRequests();
    fetchMyRequests();

    const handleOnline = () => {
      syncOfflineRequests();
      fetchMyRequests();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append('category', form.category);
    formData.append('description', form.description);
    formData.append('people_count', form.people_count);
    formData.append('latitude', coords.lat);
    formData.append('longitude', coords.lng);
    formData.append('landmark', form.landmark);
    if (image) {
      formData.append('image', image);
    }

    if (!navigator.onLine) {
      const offlineQueue = JSON.parse(localStorage.getItem('offline_requests') || '[]');
      offlineQueue.push({
        category: form.category,
        description: form.description,
        people_count: form.people_count,
        latitude: coords.lat,
        longitude: coords.lng,
        landmark: form.landmark,
        id: Date.now()
      });
      localStorage.setItem('offline_requests', JSON.stringify(offlineQueue));

      const smsPayload = `RESQNET|${form.category}|Count:${form.people_count}|Lat:${coords.lat.toFixed(4)}|Lng:${coords.lng.toFixed(4)}`;
      alert(`📶 Network Outage Detected!\n\nSimulating Secure SMS Fallback Gateway Transmission:\n"${smsPayload}"\n\nYour alert record has also been successfully cached locally inside your browser storage synchronization loop.`);
      setLoading(false);
      return;
    }

    try {
      await axios.post('http://localhost:5000/api/requests', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      alert('🚨 SOS Signal transmitted securely to the central triage dispatch mesh.');
      setForm({ category: 'Flood', description: '', people_count: 1, landmark: '' });
      setImage(null);
      const fileInput = document.getElementById('image-upload');
      if (fileInput) fileInput.value = '';
      fetchMyRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Signal ingestion failure.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between font-sans">
      <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-sm font-mono font-bold tracking-wider text-slate-800 flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-500 animate-pulse" /> RESQNET BEACON
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono bg-slate-100 px-3 py-1 rounded-full border border-slate-200 text-slate-600">
              ID: {user?.name}
            </span>
            <button onClick={logout} className="text-slate-400 hover:text-slate-600 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto px-6 py-12 space-y-6">
        {/* Distress Ingestion form Card */}
        <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Broadcast SOS Signal</h2>
            <p className="text-xs text-slate-500 mt-1">Telemetry will coordinate automatically upon signal transmission.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Incident Category</label>
              <select 
                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:border-slate-400 focus:ring-0 outline-none"
                value={form.category} onChange={e => setForm({...form, category: e.target.value})}
              >
                <option>Flood</option>
                <option>Fire Emergency</option>
                <option>Earthquake</option>
                <option>Medical Crisis</option>
                <option>Building Collapse</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Description</label>
              <textarea 
                required rows="3" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:border-slate-400 focus:ring-0 outline-none placeholder-slate-400"
                placeholder="Detail structural hazards, immediate medical trauma indicators, or rising water heights..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <Users size={12}/> Trapped Count
                </label>
                <input 
                  type="number" min="1" value={form.people_count} onChange={e => setForm({...form, people_count: parseInt(e.target.value) || 1})}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 outline-none focus:border-slate-400 text-center"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <MapPin size={12}/> Landmark
                </label>
                <input 
                  type="text" value={form.landmark} onChange={e => setForm({...form, landmark: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 outline-none focus:border-slate-400 placeholder-slate-400"
                  placeholder="Metro Gate, etc."
                />
              </div>
            </div>

            {/* Evidence Image Upload Field */}
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Evidence Photo (Optional)</label>
              <input 
                id="image-upload"
                type="file" accept="image/*"
                onChange={e => setImage(e.target.files[0])}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-500 focus:border-slate-400 outline-none file:mr-4 file:py-1.5 file:px-3.5 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-lg flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>📍 TELEMETRY COORDS:</span>
              <a href={`https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=17/${coords.lat}/${coords.lng}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </a>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold tracking-wider uppercase py-3 rounded-lg shadow-sm transition duration-150 text-xs mt-2">
              {loading ? 'Transmitting Ingestion Matrix...' : 'Transmit Active SOS Vector'}
            </button>
          </form>
        </div>

        {/* Active Distress Signals History Log */}
        {myRequests.length > 0 && (
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              My Active Distress Alerts
            </h3>
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
              {myRequests.map((req) => {
                const latestAssignment = req.Assignments && req.Assignments.length > 0 ? req.Assignments[req.Assignments.length - 1] : null;
                return (
                  <div key={req.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[9px] text-slate-400">#VECTOR {req.id}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${req.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : req.status === 'Assigned' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                        {req.status}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{req.category} ({req.people_count} Trapped)</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">{req.description}</p>
                      {req.image_path && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 bg-white max-h-[100px] flex items-center justify-center">
                          <img 
                            src={`http://localhost:5000${req.image_path}`} 
                            alt="SOS Evidence" 
                            className="object-cover w-full h-[100px]"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                      )}
                    </div>
                    {latestAssignment && (
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-indigo-700 font-medium font-mono">
                        <span>Unit: {latestAssignment.User?.name}</span>
                        <span>Dept: {latestAssignment.department}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-[9px] font-mono tracking-widest text-slate-400 border-t border-slate-200 bg-white">
        SECURE CONNECTIVITY NODE // CORE V2.5
      </footer>
    </div>
  );
}