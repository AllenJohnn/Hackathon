import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Users, MapPin, CheckCircle, Flame, UsersRound } from 'lucide-react';

export default function ResponderPortal() {
  const { token, user, logout } = useContext(AuthContext);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMissions = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMissions(res.data.filter(r => r.status === 'Assigned'));
    } catch (err) {
      console.error('Failed to pull responder mission matrices.', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();
    const interval = setInterval(fetchMissions, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCompleteMission = async (id) => {
    try {
      await axios.put(`http://localhost:5000/api/admin/requests/${id}/verify`, 
        { status: 'Completed' }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchMissions();
      alert('🔒 Mission deployment vector marked as SUCCESS/SECURED.');
    } catch (err) {
      alert('Failed to transmit closure payload upstream.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* RESPONDER RADIO TOPBAR */}
      <nav className="border-b border-slate-200 bg-white p-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Flame className="text-amber-500 animate-pulse" size={18} />
            <span className="font-mono text-xs uppercase font-bold tracking-wider text-slate-700">
              FIELD TERMINAL // UNIT: {user?.name}
            </span>
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-slate-700 text-[10px] font-mono uppercase tracking-wider border border-slate-200 px-3 py-1.5 rounded-lg transition bg-slate-50">
            Disconnect Radio
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Active Assignments</h2>
          <p className="text-xs text-slate-500 mt-1">Acknowledge coordinates and secure distress sectors immediately upon arrival.</p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs font-mono text-slate-400">Syncing with emergency network...</div>
        ) : missions.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-sm">
            <UsersRound className="mx-auto text-slate-300" size={32} />
            <p className="text-sm font-semibold text-slate-700">All local sectors are currently stable.</p>
            <p className="text-xs text-slate-400 font-mono">Standby for incoming dispatcher alerts over centralized mesh networks.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {missions.map((mission) => (
              <div key={mission.id} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-300 transition duration-150">
                <div className="space-y-2.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-150 rounded text-[10px] font-bold font-mono tracking-wide uppercase">
                      {mission.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">VECTOR: #{mission.id}</span>
                  </div>
                  
                  <p className="text-xs text-slate-600 leading-relaxed">{mission.description}</p>
                  {mission.image_path && (
                    <div className="mt-2 max-w-[150px] rounded-lg border border-slate-200 overflow-hidden bg-slate-50 shadow-sm">
                      <img 
                        src={`http://localhost:5000${mission.image_path}`} 
                        alt="SOS Evidence" 
                        className="w-full h-auto max-h-[80px] object-cover cursor-zoom-in"
                        onClick={() => window.open(`http://localhost:5000${mission.image_path}`, '_blank')}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1 font-mono">
                    <span className="flex items-center gap-1"><Users size={12} className="text-slate-400" /> {mission.people_count} Victims</span>
                    {mission.landmark && (
                      <span className="flex items-center gap-1"><MapPin size={12} className="text-slate-400" /> {mission.landmark}</span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 w-fit">
                    🎯 GPS: <a href={`https://www.openstreetmap.org/?mlat=${mission.latitude}&mlon=${mission.longitude}#map=17/${mission.latitude}/${mission.longitude}`} target="_blank" rel="noreferrer" className="hover:underline font-bold">
                      {parseFloat(mission.latitude).toFixed(4)}, {parseFloat(mission.longitude).toFixed(4)}
                    </a>
                  </div>
                  {mission.Assignments && mission.Assignments.length > 0 && (
                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                      Assigned Unit: <span className="font-semibold text-slate-700">{mission.Assignments[mission.Assignments.length - 1].User?.name}</span> ({mission.Assignments[mission.Assignments.length - 1].department})
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleCompleteMission(mission.id)}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition text-xs uppercase tracking-wider whitespace-nowrap duration-150"
                >
                  <CheckCircle size={14} /> Secure Sector
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}