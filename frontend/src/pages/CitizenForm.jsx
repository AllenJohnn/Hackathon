import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { ShieldAlert, MapPin, Users, LogOut } from 'lucide-react';
import { io } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default function CitizenForm() {
  const { token, logout, user } = useContext(AuthContext);
  const [form, setForm] = useState({ category: 'Flood', description: '', people_count: 1, landmark: '' });
  const [coords, setCoords] = useState({ lat: 9.9312, lng: 76.2673 });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [activeEvacAlert, setActiveEvacAlert] = useState(null);

  const [shelters, setShelters] = useState([]);
  const [selectedShelterNav, setSelectedShelterNav] = useState(null);
  const shelterMapRef = useRef(null);

  const fetchMyRequests = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyRequests(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchShelters = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/requests/shelters', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShelters(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const syncOfflineRequests = async () => {
    if (!navigator.onLine) return;
    const offlineQueue = JSON.parse(localStorage.getItem('resqnet_offline_queue') || '[]');
    if (offlineQueue.length === 0) return;

    for (const item of offlineQueue) {
      try {
        const formData = new FormData();
        formData.append('category', item.category);
        formData.append('description', item.description);
        formData.append('people_count', item.people_count);
        formData.append('landmark', item.landmark);
        formData.append('latitude', item.latitude);
        formData.append('longitude', item.longitude);
        
        await axios.post('http://localhost:5000/api/requests', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        });
      } catch (err) {
        console.error(err);
      }
    }
    localStorage.removeItem('resqnet_offline_queue');
    fetchMyRequests();
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("Using fallbacks.")
      );
    }

    syncOfflineRequests();
    fetchMyRequests();
    fetchShelters();

    const handleOnline = () => {
      syncOfflineRequests();
      fetchMyRequests();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [token]);

  useEffect(() => {
    const socket = io('http://localhost:5000');

    socket.on('geofencedAlert', (alertData) => {
      if (coords && coords.lat && coords.lng) {
        const dist = getDistance(coords.lat, coords.lng, alertData.latitude, alertData.longitude);
        if (dist <= 1.0) {
          setActiveEvacAlert({
            ...alertData,
            distanceMeters: Math.round(dist * 1000)
          });

          try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const playSirenNode = (startDelay) => {
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.type = 'sine';
              
              const now = audioCtx.currentTime + startDelay;
              osc.frequency.setValueAtTime(600, now);
              osc.frequency.linearRampToValueAtTime(1000, now + 0.4);
              osc.frequency.linearRampToValueAtTime(600, now + 0.8);
              osc.frequency.linearRampToValueAtTime(1000, now + 1.2);
              osc.frequency.linearRampToValueAtTime(600, now + 1.6);
              
              gain.gain.setValueAtTime(0, now);
              gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
              gain.gain.setValueAtTime(0.08, now + 1.5);
              gain.gain.linearRampToValueAtTime(0, now + 1.6);
              
              osc.start(now);
              osc.stop(now + 1.6);
            };
            
            playSirenNode(0);
            playSirenNode(1.6);
          } catch (audioErr) {
            console.warn(audioErr);
          }
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [coords]);

  useEffect(() => {
    if (selectedShelterNav && coords) {
      const userLat = parseFloat(coords.lat);
      const userLng = parseFloat(coords.lng);
      const shelterLat = parseFloat(selectedShelterNav.latitude);
      const shelterLng = parseFloat(selectedShelterNav.longitude);

      if (!isNaN(userLat) && !isNaN(userLng) && !isNaN(shelterLat) && !isNaN(shelterLng)) {
        const timer = setTimeout(() => {
          const mapEl = document.getElementById('shelter-map-container');
          if (mapEl && !shelterMapRef.current) {
            const bounds = L.latLngBounds([[userLat, userLng], [shelterLat, shelterLng]]);
            const map = L.map('shelter-map-container').fitBounds(bounds, { padding: [50, 50] });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
              subdomains: 'abcd',
              maxZoom: 20
            }).addTo(map);

            const userIcon = L.divIcon({
              html: `
                <div class="relative flex items-center justify-center w-6 h-6">
                  <span class="absolute inline-flex h-full w-full rounded-full animate-ping bg-blue-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-3 w-3 bg-blue-600 border border-white"></span>
                </div>
              `,
              className: 'custom-user-icon',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            L.marker([userLat, userLng], { icon: userIcon })
              .addTo(map)
              .bindPopup("<strong>Your Location</strong>")
              .openPopup();

            const shelterIcon = L.divIcon({
              html: `
                <div class="relative flex items-center justify-center w-6 h-6">
                  <span class="absolute inline-flex h-full w-full rounded-full animate-pulse bg-emerald-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-4.5 w-4.5 bg-emerald-600 border border-white text-white flex items-center justify-center text-[9px] font-bold">🏥</span>
                </div>
              `,
              className: 'custom-shelter-icon',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            L.marker([shelterLat, shelterLng], { icon: shelterIcon })
              .addTo(map)
              .bindPopup(`<strong>${selectedShelterNav.name}</strong><br/>Spots: ${selectedShelterNav.occupied}/${selectedShelterNav.capacity}`);

            L.polyline([[userLat, userLng], [shelterLat, shelterLng]], {
              color: '#10b981',
              weight: 3,
              dashArray: '6, 6'
            }).addTo(map);

            shelterMapRef.current = map;
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    } else {
      if (shelterMapRef.current) {
        shelterMapRef.current.remove();
        shelterMapRef.current = null;
      }
    }

    return () => {
      if (shelterMapRef.current) {
        shelterMapRef.current.remove();
        shelterMapRef.current = null;
      }
    };
  }, [selectedShelterNav, coords]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const finalCategory = form.category === 'Others' && form.otherCategory ? form.otherCategory : form.category;

    if (!navigator.onLine) {
      const offlineQueue = JSON.parse(localStorage.getItem('resqnet_offline_queue') || '[]');
      offlineQueue.push({
        ...form,
        category: finalCategory,
        latitude: coords.lat,
        longitude: coords.lng,
        id: Date.now()
      });
      localStorage.setItem('resqnet_offline_queue', JSON.stringify(offlineQueue));
      
      const smsPayload = `RESQNET|${finalCategory}|Count:${form.people_count}|Lat:${coords.lat.toFixed(4)}|Lng:${coords.lng.toFixed(4)}`;
      
      try {
        await axios.post('http://localhost:5000/api/admin/sms-inbox/simulate', {
          sender_phone: user?.phone || '+15550199',
          raw_message: smsPayload
        });
      } catch (smsErr) {
        console.error(smsErr);
      }

      alert(`📶 Network Outage Detected!\n\nSimulating Secure SMS Fallback Gateway Transmission:\n"${smsPayload}"\n\nYour alert has also been cached locally.`);
      setLoading(false);
      setForm({ category: 'Flood', description: '', people_count: 1, landmark: '' });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('category', finalCategory);
      formData.append('description', form.description);
      formData.append('people_count', form.people_count);
      formData.append('landmark', form.landmark);
      formData.append('latitude', coords.lat);
      formData.append('longitude', coords.lng);
      if (image) formData.append('image', image);

      await axios.post('http://localhost:5000/api/requests', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });

      setForm({ category: 'Flood', description: '', people_count: 1, landmark: '' });
      setImage(null);
      const fileInput = document.getElementById('image-upload');
      if (fileInput) fileInput.value = '';

      fetchMyRequests();
      alert('SOS Transmission Succeeded. Tactical dispatch vectors deployed.');
    } catch (err) {
      alert('SOS Ingestion Transmission failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-sm">
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
        <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Broadcast SOS Signal</h2>
            <p className="text-xs text-slate-500 mt-1">Telemetry will coordinate automatically upon signal transmission.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Incident Category</label>
              <select 
                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:border-slate-400 focus:ring-0 outline-none font-sans"
                value={form.category} onChange={e => setForm({...form, category: e.target.value})}
              >
                <option>Flood</option>
                <option>Fire Emergency</option>
                <option>Earthquake</option>
                <option>Medical Crisis</option>
                <option>Building Collapse</option>
                <option>Others</option>
              </select>
            </div>

            {form.category === 'Others' && (
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Specify Category</label>
                <input 
                  type="text" 
                  placeholder="E.g., Gas Leak, Chemical Spill" 
                  value={form.otherCategory || ''} 
                  onChange={e => setForm({...form, otherCategory: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 focus:border-slate-400 outline-none"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Situation Description</label>
              <textarea 
                placeholder="Details of distress condition (e.g. rising water levels, trapped elderly...)"
                value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                rows={3}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 focus:border-slate-400 outline-none resize-none font-sans"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Impacted People</label>
                <input 
                  type="number" min={1}
                  value={form.people_count} onChange={e => setForm({...form, people_count: parseInt(e.target.value) || 1})}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 focus:border-slate-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Landmark Reference</label>
                <input 
                  type="text" placeholder="E.g., near City Library"
                  value={form.landmark} onChange={e => setForm({...form, landmark: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 focus:border-slate-400 outline-none"
                />
              </div>
            </div>

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

        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider font-mono">🏥 Nearby Evacuation Shelters</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Real-time occupancy and closest safe zones calculated from your coordinate beacon.</p>
          </div>

          {shelters.length === 0 ? (
            <p className="text-xs text-slate-455 italic font-mono">No evacuation shelters mapped in your sector.</p>
          ) : (
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
              {shelters
                .map(s => {
                  const dist = getDistance(coords.lat, coords.lng, s.latitude, s.longitude);
                  return { ...s, distanceKm: dist };
                })
                .sort((a, b) => a.distanceKm - b.distanceKm)
                .map(s => {
                  const distMeters = Math.round(s.distanceKm * 1000);
                  const usagePercentage = ((s.occupied / s.capacity) * 100).toFixed(0);
                  const usageColor = usagePercentage > 85 ? 'text-red-650 bg-red-50 border-red-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100';
                  return (
                    <div key={s.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex justify-between items-center gap-3">
                      <div className="space-y-1 w-full max-w-[70%]">
                        <span className="text-xs font-bold text-slate-800 block">{s.name}</span>
                        <div className="flex gap-2 text-[9px] font-mono text-slate-500 flex-wrap">
                          <span className="px-1 py-0.2 rounded border bg-white">📏 {distMeters}m away</span>
                          <span className={`px-1 py-0.2 rounded border font-bold ${usageColor}`}>📊 {s.occupied} / {s.capacity} spots</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedShelterNav(s)}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] uppercase tracking-wider rounded transition whitespace-nowrap shadow-sm"
                      >
                        🗺️ Route Map
                      </button>
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>

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
                      <p className="text-[11px] text-slate-505 mt-0.5 leading-normal">{req.description}</p>
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

      {activeEvacAlert && (
        <div className="fixed inset-0 bg-red-950/70 backdrop-blur-md z-[9999] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white border-4 border-red-500 rounded-3xl p-8 shadow-2xl w-full max-w-md relative flex flex-col items-center text-center space-y-5 animate-bounce-short">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 border border-red-200 animate-pulse">
              <ShieldAlert size={36} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-black text-red-500 tracking-widest uppercase">🚨 RADIUS EVACUATION WARNING 🚨</span>
              <h3 className="font-black text-lg text-slate-900 tracking-tight">Active Danger Vector Detected</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-mono bg-slate-50 border border-slate-200 p-4 rounded-2xl">
              A <strong className="text-red-600 uppercase">{activeEvacAlert.priority}</strong> priority <strong className="text-slate-800">{activeEvacAlert.category}</strong> hazard has been verified just <strong className="text-red-600 font-bold underline">{activeEvacAlert.distanceMeters} meters</strong> from your live coordinate beacon!
            </p>
            <p className="text-[11px] text-slate-400 italic">
              "Sector description: {activeEvacAlert.description}"
            </p>
            <div className="w-full space-y-2">
              <button 
                onClick={() => setActiveEvacAlert(null)}
                className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold tracking-widest uppercase py-3.5 rounded-2xl shadow-lg transition duration-150 text-xs shadow-red-200 focus:outline-none"
              >
                Acknowledge & Seek Safety
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedShelterNav && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl w-full max-w-lg relative flex flex-col space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Safe Evacuation Route Radar</span>
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 mt-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  {selectedShelterNav.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedShelterNav(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm transition"
              >
                ✕
              </button>
            </div>
            <div className="w-full h-[300px] border border-slate-200 rounded-2xl overflow-hidden relative shadow-inner">
              <div id="shelter-map-container" className="w-full h-full z-10"></div>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-1">
              <span>DESTINATION: {parseFloat(selectedShelterNav.latitude).toFixed(4)}, {parseFloat(selectedShelterNav.longitude).toFixed(4)}</span>
              <span>OCCUPANCY: <strong className="text-emerald-600">{selectedShelterNav.occupied} / {selectedShelterNav.capacity} spots</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}