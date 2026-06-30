import React, { useEffect, useState, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Users, MapPin, CheckCircle, Flame, UsersRound } from 'lucide-react';
import { io } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function ResponderPortal() {
  const { token, user, logout } = useContext(AuthContext);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
 
  const [selectedNavMission, setSelectedNavMission] = useState(null);
  const navMapRef = useRef(null);
  const missionsCountRef = useRef(0);

  const fetchMissions = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const activeMissions = res.data.filter(r => ['Assigned', 'Accepted'].includes(r.status));
      setMissions(activeMissions);
 
      if (activeMissions.length > missionsCountRef.current) {
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const playTone = (freq, duration, delay) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
            gain.gain.setValueAtTime(0.04, audioCtx.currentTime + delay);
            osc.start(audioCtx.currentTime + delay);
            osc.stop(audioCtx.currentTime + delay + duration);
          };
          playTone(960, 0.2, 0);
          playTone(770, 0.2, 0.2);
          playTone(960, 0.2, 0.4);
          playTone(770, 0.2, 0.6);
        } catch (audioErr) {
          console.warn("Audio alert blocked:", audioErr);
        }
      }
      missionsCountRef.current = activeMissions.length;
    } catch (err) {
      console.error('Failed to pull responder mission matrices.', err);
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    fetchMissions();
    const interval = setInterval(fetchMissions, 15000);
    return () => clearInterval(interval);
  }, []);
 
  useEffect(() => {
    const socket = io('http://localhost:5000');
 
    socket.on('newRequest', () => fetchMissions());
    socket.on('requestUpdated', () => fetchMissions());
 
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selectedNavMission) {
      const lat = parseFloat(selectedNavMission.latitude);
      const lng = parseFloat(selectedNavMission.longitude);
 
      if (!isNaN(lat) && !isNaN(lng)) {
        const timer = setTimeout(() => {
          const mapEl = document.getElementById('nav-map-container');
          if (mapEl && !navMapRef.current) {
            const map = L.map('nav-map-container').setView([lat, lng], 15);
 
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
              subdomains: 'abcd',
              maxZoom: 20
            }).addTo(map);
 
            const colorClass = selectedNavMission.status === 'Accepted' ? 'bg-amber-500 border-amber-200' : 'bg-red-500 border-red-200';
            const icon = L.divIcon({
              html: `
                <div class="relative flex items-center justify-center w-6 h-6">
                  <span class="absolute inline-flex h-full w-full rounded-full animate-ping bg-indigo-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-3.5 w-3.5 ${colorClass} border-2 border-white shadow-md"></span>
                </div>
              `,
              className: 'custom-leaflet-icon',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
 
            L.marker([lat, lng], { icon })
              .addTo(map)
              .bindPopup(`
                <div style="font-family: sans-serif; font-size: 11px; line-height: 1.4; color: #1e293b;">
                  <strong>${selectedNavMission.category}</strong><br/>
                  Landmark: ${selectedNavMission.landmark || 'None'}
                </div>
              `)
              .openPopup();
 
            navMapRef.current = map;
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    } else {
      if (navMapRef.current) {
        navMapRef.current.remove();
        navMapRef.current = null;
      }
    }
 
    return () => {
      if (navMapRef.current) {
        navMapRef.current.remove();
        navMapRef.current = null;
      }
    };
  }, [selectedNavMission]);

  const handleUpdateMissionStatus = async (id, nextStatus) => {
    try {
      await axios.put(`http://localhost:5000/api/admin/requests/${id}/verify`, 
        { status: nextStatus }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchMissions();
      if (nextStatus === 'Accepted') {
        alert('🚀 Mission acknowledged. Sector en-route status broadcasted upstream.');
      } else if (nextStatus === 'Completed') {
        alert('🔒 Mission deployment vector marked as SUCCESS/SECURED.');
      }
    } catch (err) {
      alert('Failed to transmit status update payload upstream.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Flame className="text-red-500 animate-pulse" size={16} />
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
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 w-fit">
                      🎯 GPS: {parseFloat(mission.latitude).toFixed(4)}, {parseFloat(mission.longitude).toFixed(4)}
                    </div>
                    <button 
                      onClick={() => setSelectedNavMission(mission)}
                      className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded text-[9px] font-mono font-semibold flex items-center gap-1 transition shadow-sm"
                    >
                      🗺️ Nav Map
                    </button>
                  </div>
                  {mission.Assignments && mission.Assignments.length > 0 && (
                    <div className="text-[10px] font-mono text-slate-505 mt-1 space-y-1">
                      <span className="font-semibold text-slate-700 block">Assigned Units:</span>
                      <div className="flex flex-wrap gap-1">
                        {mission.Assignments.map((asg, idx) => (
                          <span key={asg.id || idx} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[9px] whitespace-nowrap">
                            {asg.department} ({asg.User?.name || 'Unit'})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {mission.status === 'Assigned' ? (
                  <button
                    onClick={() => handleUpdateMissionStatus(mission.id, 'Accepted')}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition text-xs uppercase tracking-wider whitespace-nowrap duration-150 shadow-blue-100"
                  >
                    🚀 Accept Mission
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateMissionStatus(mission.id, 'Completed')}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition text-xs uppercase tracking-wider whitespace-nowrap duration-150 shadow-emerald-100"
                  >
                    <CheckCircle size={14} /> Secure Sector
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* NAVIGATION MAP MODAL */}
      {selectedNavMission && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl w-full max-w-lg relative flex flex-col space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Dispatched Mission Radar</span>
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 mt-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
                  #{selectedNavMission.id} - {selectedNavMission.category}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedNavMission(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm transition"
              >
                ✕
              </button>
            </div>
 
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 p-3 rounded-xl font-mono leading-relaxed">
              <span className="font-bold text-slate-800">Target Sector:</span> {selectedNavMission.description}
              {selectedNavMission.landmark && (
                <div className="mt-1">📍 <span className="font-bold text-slate-800">Landmark:</span> {selectedNavMission.landmark}</div>
              )}
            </div>
 
            <div className="w-full h-[300px] border border-slate-200 rounded-2xl overflow-hidden relative shadow-inner">
              <div id="nav-map-container" className="w-full h-full z-10"></div>
            </div>
            
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-1">
              <span>COORDS: {parseFloat(selectedNavMission.latitude).toFixed(5)}, {parseFloat(selectedNavMission.longitude).toFixed(5)}</span>
              <span className="uppercase">STATUS: <strong className="text-indigo-600">{selectedNavMission.status}</strong></span>
            </div>
 
          </div>
        </div>
      )}
    </div>
  );
}