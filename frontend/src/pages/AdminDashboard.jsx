import React, { useEffect, useState, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { io } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Activity, 
  Clock, 
  ShieldAlert, 
  CheckCircle, 
  Users, 
  MapPin, 
  LogOut, 
  AlertTriangle 
} from 'lucide-react';

const createMarkerIcon = (priority) => {
  const colorClass = 
    priority === 'Critical' ? 'bg-red-500 border-red-200 text-red-100' :
    priority === 'High' ? 'bg-amber-500 border-amber-200 text-amber-100' :
    'bg-blue-500 border-blue-200 text-blue-100';
 
  const pulseClass = 
    priority === 'Critical' ? 'animate-ping bg-red-400' :
    priority === 'High' ? 'animate-pulse bg-amber-400' :
    'bg-blue-400';
 
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center w-6 h-6">
        <span class="absolute inline-flex h-full w-full rounded-full ${pulseClass} opacity-75"></span>
        <span class="relative inline-flex rounded-full h-3.5 w-3.5 ${colorClass} border-2 border-white shadow-md"></span>
      </div>
    `,
    className: 'custom-leaflet-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

export default function AdminDashboard() {
  const { token, logout, user } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [responders, setResponders] = useState([]);
  const [activeTab, setActiveTab] = useState('active');
  const [dispatchState, setDispatchState] = useState({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, critical: 0, completed: 0 });
 
  const [selectedMapRequest, setSelectedMapRequest] = useState(null);
  const [selectedMapLogs, setSelectedMapLogs] = useState([]);
  const modalMapRef = useRef(null);
 
  const [smsMessages, setSmsMessages] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [weather, setWeather] = useState(null);
 
  const [simPhone, setSimPhone] = useState('');
  const [simMessage, setSimMessage] = useState('');
  
  const [shelterName, setShelterName] = useState('');
  const [shelterLat, setShelterLat] = useState('');
  const [shelterLng, setShelterLng] = useState('');
  const [shelterCap, setShelterCap] = useState(100);
 
  const fetchRequests = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(res.data);
      
      const data = res.data;
      setStats({
        total: data.length,
        pending: data.filter(r => r.status !== 'Completed').length,
        critical: data.filter(r => r.EmergencyAnalysis?.priority === 'Critical').length,
        completed: data.filter(r => r.status === 'Completed').length
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
 
  const fetchResponders = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/responders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResponders(res.data);
    } catch (err) {
      console.error(err);
    }
  };
 
  const fetchSmsMessages = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/sms-inbox', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSmsMessages(res.data);
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
 
  const fetchWeather = async () => {
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=9.9312&longitude=76.2673&current_weather=true');
      const data = await res.json();
      if (data && data.current_weather) {
        setWeather(data.current_weather);
      }
    } catch (err) {
      console.warn(err);
    }
  };
 
  const handleSimulateSms = async (e) => {
    e.preventDefault();
    if (!simPhone || !simMessage) return;
    try {
      await axios.post('http://localhost:5000/api/admin/sms-inbox/simulate', {
        sender_phone: simPhone,
        raw_message: simMessage
      });
      setSimPhone('');
      setSimMessage('');
      fetchSmsMessages();
      alert('Simulated SMS message logged.');
    } catch (err) {
      alert('Simulation failed.');
    }
  };
 
  const handleIngestSms = async (smsId) => {
    try {
      const res = await axios.post(`http://localhost:5000/api/admin/sms-inbox/${smsId}/ingest`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSmsMessages();
      fetchRequests();
      alert(`SMS Emergency Ingested: ID #${res.data.request.id}`);
    } catch (err) {
      alert('Ingestion failed: ' + (err.response?.data?.message || err.message));
    }
  };
 
  const handleCreateShelter = async (e) => {
    e.preventDefault();
    if (!shelterName || !shelterLat || !shelterLng || !shelterCap) return;
    try {
      await axios.post('http://localhost:5000/api/admin/shelters', {
        name: shelterName,
        latitude: parseFloat(shelterLat),
        longitude: parseFloat(shelterLng),
        capacity: parseInt(shelterCap),
        occupied: 0
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShelterName('');
      setShelterLat('');
      setShelterLng('');
      setShelterCap(100);
      fetchShelters();
      alert('Shelter registered successfully.');
    } catch (err) {
      alert('Failed to register shelter.');
    }
  };
 
  const handleUpdateShelterOccupancy = async (id, currentOccupied) => {
    const nextOccupied = prompt('Enter updated occupant count:', currentOccupied);
    if (nextOccupied === null) return;
    const occupiedNum = parseInt(nextOccupied);
    if (isNaN(occupiedNum) || occupiedNum < 0) {
      alert('Invalid occupant count.');
      return;
    }
    try {
      await axios.put(`http://localhost:5000/api/admin/shelters/${id}`, {
        occupied: occupiedNum
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchShelters();
      alert('Shelter occupancy updated.');
    } catch (err) {
      alert('Failed to update shelter occupancy.');
    }
  };
 
  const getRecommendedResponder = (reqCategory) => {
    if (responders.length === 0) return null;
    const sorted = [...responders].sort((a, b) => {
      const aCount = parseInt(a.activeMissionsCount || 0);
      const bCount = parseInt(b.activeMissionsCount || 0);
      return aCount - bCount;
    });
    return sorted[0];
  };
 
  useEffect(() => {
    fetchRequests();
    fetchResponders();
    fetchShelters();
    fetchWeather();
    fetchSmsMessages();
 
    const interval = setInterval(() => {
      fetchRequests();
      fetchSmsMessages();
    }, 15005);
 
    return () => clearInterval(interval);
  }, []);
 
  useEffect(() => {
    if (selectedMapRequest) {
      axios.get(`http://localhost:5000/api/requests/${selectedMapRequest.id}/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => setSelectedMapLogs(res.data))
      .catch(err => console.error(err));
    } else {
      setSelectedMapLogs([]);
    }
  }, [selectedMapRequest]);

  useEffect(() => {
    const socket = io('http://localhost:5000');
 
    socket.on('newRequest', (newReq) => {
      setRequests(prev => {
        if (prev.some(r => r.id === newReq.id)) return prev;
        return [newReq, ...prev];
      });
 
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch (audioErr) {
        console.warn(audioErr);
      }
    });
 
    socket.on('requestUpdated', (updatedReq) => {
      setRequests(prev => prev.map(r => r.id === updatedReq.id ? updatedReq : r));
    });
 
    return () => {
      socket.disconnect();
    };
  }, []);
 
  useEffect(() => {
    if (selectedMapRequest) {
      const lat = parseFloat(selectedMapRequest.latitude);
      const lng = parseFloat(selectedMapRequest.longitude);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        const timer = setTimeout(() => {
          const mapEl = document.getElementById('modal-map-container');
          if (mapEl && !modalMapRef.current) {
            const map = L.map('modal-map-container').setView([lat, lng], 15);
            
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
              subdomains: 'abcd',
              maxZoom: 20
            }).addTo(map);
 
            const priority = selectedMapRequest.EmergencyAnalysis?.priority || 'Medium';
            const icon = createMarkerIcon(priority);
 
            const popupContent = `
              <div style="font-family: sans-serif; padding: 4px; color: #1e293b; font-size: 11px; line-height: 1.4;">
                <div style="display: flex; align-items: center; gap: 6px; font-weight: bold; margin-bottom: 4px;">
                  <span style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 9px; color: #475569;">${selectedMapRequest.category}</span>
                  <span style="color: #94a3b8;">#${selectedMapRequest.id}</span>
                </div>
                <p style="margin: 0; font-weight: 600; color: #334155;">${selectedMapRequest.description.slice(0, 100)}${selectedMapRequest.description.length > 100 ? '...' : ''}</p>
                <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #64748b;">
                  <span>Priority: <strong>${priority}</strong></span>
                  <span style="margin-left: auto;">Status: <strong>${selectedMapRequest.status}</strong></span>
                </div>
              </div>
            `;
 
            L.marker([lat, lng], { icon })
              .addTo(map)
              .bindPopup(popupContent)
              .openPopup();
 
            modalMapRef.current = map;
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    } else {
      if (modalMapRef.current) {
        modalMapRef.current.remove();
        modalMapRef.current = null;
      }
    }
 
    return () => {
      if (modalMapRef.current) {
        modalMapRef.current.remove();
        modalMapRef.current = null;
      }
    };
  }, [selectedMapRequest]);
 
  const handleOverridePriority = async (id, currentPriority) => {
    const nextPriorityMap = { 'Low': 'Medium', 'Medium': 'High', 'High': 'Critical', 'Critical': 'Low' };
    const manualPriority = nextPriorityMap[currentPriority] || 'Medium';
 
    try {
      await axios.put(`http://localhost:5000/api/admin/requests/${id}/verify`, { manualPriority }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchRequests();
    } catch (err) {
      alert('Manual prioritization override failed.');
    }
  };
 
  const setRowDispatch = (requestId, key, value) => {
    setDispatchState(prev => ({
      ...prev,
      [requestId]: {
        ...prev[requestId],
        [key]: value
      }
    }));
  };
 
  const toggleDepartment = (requestId, dept) => {
    setDispatchState(prev => {
      const currentDepts = prev[requestId]?.departments || [];
      const nextDepts = currentDepts.includes(dept)
        ? currentDepts.filter(d => d !== dept)
        : [...currentDepts, dept];
      return {
        ...prev,
        [requestId]: {
          ...prev[requestId],
          departments: nextDepts
        }
      };
    });
  };
 
  const handleAssignResponder = async (requestId) => {
    const state = dispatchState[requestId];
    const responderId = state?.responderId;
    const departments = state?.departments || [];
 
    if (!responderId) {
      alert('Select a responder unit first.');
      return;
    }
 
    try {
      await axios.post('http://localhost:5000/api/admin/assignments', {
        request_id: requestId,
        responder_id: parseInt(responderId),
        departments
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
 
      setDispatchState(prev => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
 
      fetchRequests();
      alert('Strategic dispatches finalized upstream.');
    } catch (err) {
      alert('Strategic dispatches mapping configuration failed.');
    }
  };
 
  const handleVerifyRequest = async (id) => {
    try {
      await axios.put(`http://localhost:5000/api/admin/requests/${id}/verify`, { status: 'Verified' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchRequests();
      alert('AI Triage priority verified.');
    } catch (err) {
      alert('AI Triage verification failed.');
    }
  };
 
  const displayedRequests = requests.filter(r => {
    if (activeTab === 'active') return r.status !== 'Completed';
    if (activeTab === 'all') return true;
    return false;
  });
 
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="text-red-500 animate-pulse" size={16} />
            <span className="font-mono text-xs uppercase font-bold tracking-wider text-slate-700">
              ResQNet Command Console // Admin Terminal
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">
              Sector Op: {user?.name}
            </span>
            <button onClick={logout} className="text-slate-455 hover:text-slate-655 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
 
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {weather && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl animate-fade-in">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 font-extrabold text-xs font-mono">
                {weather.temperature}°C
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-450 font-mono">Meteorological Telemetry Sensor</div>
                <h4 className="font-extrabold text-sm flex items-center gap-2 mt-0.5">
                  ⛅ Live Climate: Kochi Sector (Wind: {weather.windspeed} km/h)
                </h4>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {[51,53,55,61,63,65,80,81,82,95,96,99].includes(weather.weathercode) ? (
                <span className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-[10px] font-bold font-mono animate-pulse">
                  ⚠️ SEVERE WEATHER ALERT: HIGH PRECIPITATION (FLOOD THREAT)
                </span>
              ) : (
                <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-bold font-mono">
                  ☀️ SECTOR CLIMATE MONITOR: NOMINAL
                </span>
              )}
            </div>
          </div>
        )}
 
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl flex justify-between items-center shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Telemetry</p>
              <p className="text-2xl font-black mt-1 text-slate-900">{stats.total}</p>
            </div>
            <Activity className="text-slate-400" size={24} />
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-2xl flex justify-between items-center shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Queue</p>
              <p className="text-2xl font-black mt-1 text-amber-600">{stats.pending}</p>
            </div>
            <Clock className="text-amber-500" size={24} />
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-2xl flex justify-between items-center shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Critical Dangers</p>
              <p className="text-2xl font-black mt-1 text-red-600">{stats.critical}</p>
            </div>
            <ShieldAlert className="text-red-500" size={24} />
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-2xl flex justify-between items-center shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Closed Vectors</p>
              <p className="text-2xl font-black mt-1 text-emerald-600">{stats.completed}</p>
            </div>
            <CheckCircle className="text-emerald-500" size={24} />
          </div>
        </div>
 
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-150 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h3 className="font-bold text-xs text-slate-700 uppercase tracking-widest">
              {activeTab === 'analytics' ? 'Tactical Ingestion Analytics' : activeTab === 'sms' ? 'SMS Cellular Mesh Feed' : 'Live Ingestion Matrix'}
            </h3>
            
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 w-full sm:max-w-xl text-[10px]">
              <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 text-center py-1.5 px-3 font-bold rounded-md transition-all ${activeTab === 'active' ? 'bg-white text-slate-800 shadow-sm border border-slate-250/20' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Active ({requests.filter(r => r.status !== 'Completed').length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 text-center py-1.5 px-3 font-bold rounded-md transition-all ${activeTab === 'all' ? 'bg-white text-slate-800 shadow-sm border border-slate-250/20' : 'text-slate-500 hover:text-slate-800'}`}
              >
                All Archives ({requests.length})
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 text-center py-1.5 px-3 font-bold rounded-md transition-all ${activeTab === 'analytics' ? 'bg-white text-slate-800 shadow-sm border border-slate-250/20' : 'text-slate-500 hover:text-slate-800'}`}
              >
                📊 Analytics
              </button>
              <button
                onClick={() => setActiveTab('sms')}
                className={`flex-1 text-center py-1.5 px-3 font-bold rounded-md transition-all ${activeTab === 'sms' ? 'bg-white text-slate-800 shadow-sm border border-slate-250/20' : 'text-slate-500 hover:text-slate-800'}`}
              >
                📟 SMS Gateway ({smsMessages.filter(s => s.status === 'Pending').length})
              </button>
            </div>
          </div>
 
          {loading ? (
            <div className="p-12 text-center text-xs font-mono text-slate-400">Accessing tracking registries...</div>
          ) : activeTab === 'analytics' ? (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="border border-slate-100 rounded-xl p-5 bg-slate-50/30 space-y-4">
                  <h4 className="font-bold text-[10px] uppercase text-slate-400 tracking-wider">Calamity Distribution Ratio</h4>
                  <div className="space-y-3.5">
                    {['Flood', 'Fire Emergency', 'Earthquake', 'Medical Crisis', 'Building Collapse', 'Others'].map(cat => {
                      const count = requests.filter(r => r.category === cat || (cat === 'Others' && !['Flood', 'Fire Emergency', 'Earthquake', 'Medical Crisis', 'Building Collapse'].includes(r.category))).length;
                      const percentage = requests.length > 0 ? ((count / requests.length) * 100).toFixed(0) : 0;
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-slate-700">{cat}</span>
                            <span className="text-slate-500 font-mono">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
 
                <div className="border border-slate-100 rounded-xl p-5 bg-slate-50/30 space-y-4">
                  <h4 className="font-bold text-[10px] uppercase text-slate-400 tracking-wider">AI Priority Segmentation</h4>
                  <div className="space-y-3.5">
                    {['Critical', 'High', 'Medium', 'Low'].map(prio => {
                      const count = requests.filter(r => r.EmergencyAnalysis?.priority === prio).length;
                      const percentage = requests.length > 0 ? ((count / requests.length) * 100).toFixed(0) : 0;
                      const color = 
                        prio === 'Critical' ? 'bg-red-500' :
                        prio === 'High' ? 'bg-amber-500' :
                        prio === 'Medium' ? 'bg-blue-500' : 'bg-slate-400';
                      return (
                        <div key={prio} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-slate-700">{prio}</span>
                            <span className="text-slate-500 font-mono">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
 
              </div>
 
              <div className="border border-slate-100 rounded-xl p-5 bg-slate-50/30 space-y-4">
                <h4 className="font-bold text-[10px] uppercase text-slate-400 tracking-wider">Rescue Unit Operational Workload</h4>
                {responders.length === 0 ? (
                  <p className="text-xs text-slate-400 font-mono">No active responder telemetry.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {responders.map(r => {
                      const activeCount = parseInt(r.activeMissionsCount || 0);
                      const statusColor = activeCount > 2 ? 'text-red-650 bg-red-50 border-red-100' : activeCount > 0 ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100';
                      return (
                        <div key={r.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 shadow-sm">
                          <p className="text-xs font-bold text-slate-800">{r.name}</p>
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-slate-400">ACTIVE MISSIONS</span>
                            <span className={`px-2 py-0.5 rounded border font-bold ${statusColor}`}>{activeCount}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
 
              <div className="border border-slate-100 rounded-xl p-5 bg-slate-50/30 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-[10px] uppercase text-slate-400 tracking-wider font-mono">🏥 Evacuation Shelters Registry</h4>
                  <span className="text-[9px] font-mono text-slate-400">ACTIVE SAFE ZONES</span>
                </div>
 
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <form onSubmit={handleCreateShelter} className="border border-slate-200 bg-white p-4 rounded-xl space-y-3 shadow-sm h-fit">
                    <h5 className="font-bold text-[10px] text-slate-700 uppercase font-mono">Register Safe Zone</h5>
                    <div className="space-y-2">
                      <input 
                        type="text" 
                        value={shelterName}
                        onChange={e => setShelterName(e.target.value)}
                        placeholder="Shelter Name (e.g., City Gym)"
                        className="w-full bg-slate-550 border border-slate-200 text-[10px] rounded p-2 outline-none focus:bg-white font-mono"
                        required
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="number" 
                          step="0.0001"
                          value={shelterLat}
                          onChange={e => setShelterLat(e.target.value)}
                          placeholder="Latitude"
                          className="w-full bg-slate-50 border border-slate-200 text-[10px] rounded p-2 outline-none focus:bg-white font-mono"
                          required
                        />
                        <input 
                          type="number" 
                          step="0.0001"
                          value={shelterLng}
                          onChange={e => setShelterLng(e.target.value)}
                          placeholder="Longitude"
                          className="w-full bg-slate-50 border border-slate-200 text-[10px] rounded p-2 outline-none focus:bg-white font-mono"
                          required
                        />
                      </div>
                      <input 
                        type="number" 
                        value={shelterCap}
                        onChange={e => setShelterCap(e.target.value)}
                        placeholder="Max Capacity (e.g., 150)"
                        className="w-full bg-slate-50 border border-slate-200 text-[10px] rounded p-2 outline-none focus:bg-white font-mono"
                        required
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[9px] py-2 rounded uppercase tracking-wider transition font-mono shadow-sm shadow-indigo-100"
                    >
                      🏥 Log Shelter
                    </button>
                  </form>
 
                  <div className="lg:col-span-2 space-y-3 max-h-[220px] overflow-y-auto pr-1 w-full">
                    {shelters.length === 0 ? (
                      <p className="text-xs text-slate-400 font-mono py-6 text-center">No shelters logged in registry.</p>
                    ) : (
                      shelters.map(s => {
                        const usagePercentage = ((s.occupied / s.capacity) * 100).toFixed(0);
                        const usageColor = usagePercentage > 85 ? 'bg-red-500' : usagePercentage > 50 ? 'bg-amber-500' : 'bg-emerald-500';
                        return (
                          <div key={s.id} className="p-4 bg-white border border-slate-200 rounded-xl flex justify-between items-center shadow-sm w-full">
                            <div className="space-y-1.5 w-full max-w-[70%]">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">{s.name}</span>
                                <span className="text-[8px] font-mono text-slate-400">({parseFloat(s.latitude).toFixed(4)}, {parseFloat(s.longitude).toFixed(4)})</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div className={`${usageColor} h-full rounded-full`} style={{ width: `${usagePercentage}%` }}></div>
                              </div>
                              <span className="text-[9px] font-mono text-slate-500 block">
                                Occupancy: <strong>{s.occupied}</strong> / {s.capacity} spots taken ({usagePercentage}%)
                              </span>
                            </div>
                            
                            <button
                              onClick={() => handleUpdateShelterOccupancy(s.id, s.occupied)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-[9px] font-bold text-slate-700 transition"
                            >
                              ⚙️ Occupancy
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
 
                </div>
              </div>
            </div>
          ) : activeTab === 'sms' ? (
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-4 h-fit">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-800">📟 SMS Cellular Mesh Simulator</h4>
                  <p className="text-[10px] text-slate-405 mt-1 font-mono">Simulate raw emergency distress text signals routed from cell towers during network outages.</p>
                </div>
                
                <form onSubmit={handleSimulateSms} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Sender Phone</label>
                    <input 
                      type="text" 
                      value={simPhone}
                      onChange={e => setSimPhone(e.target.value)}
                      placeholder="+919495000000"
                      className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 outline-none focus:border-slate-350 font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Message Content</label>
                    <textarea 
                      value={simMessage}
                      onChange={e => setSimMessage(e.target.value)}
                      placeholder="E.g., heavy flooding near Cochin High School, three citizens trapped on second floor"
                      rows={4}
                      className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2.5 outline-none focus:border-slate-350 resize-none font-mono"
                      required
                    />
                  </div>
                  
                  <button 
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-sm transition font-mono"
                  >
                    📡 Simulate SMS SOS Signal
                  </button>
                </form>
              </div>
 
              <div className="lg:col-span-2 border border-slate-200 rounded-2xl p-5 space-y-4 bg-white shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h4 className="font-extrabold text-xs text-slate-800">📥 Cellular SMS Intake Monitor</h4>
                  <span className="text-[9px] text-indigo-650 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5 font-bold font-mono">GATEWAY LINK ACTIVE</span>
                </div>
 
                {smsMessages.length === 0 ? (
                  <div className="text-center py-12 text-xs font-mono text-slate-400">No cell messages logged in SMS inbox.</div>
                ) : (
                  <div className="space-y-3.5 max-h-[450px] overflow-y-auto pr-1">
                    {smsMessages.map(msg => (
                      <div key={msg.id} className={`p-4 rounded-xl border flex justify-between items-center gap-4 transition shadow-sm ${msg.status === 'Ingested' ? 'bg-slate-50/50 border-slate-100 opacity-60' : 'bg-white border-slate-200'}`}>
                        <div className="space-y-1.5 max-w-md">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-805">{msg.sender_phone}</span>
                            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${msg.status === 'Ingested' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                              {msg.status}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">({new Date(msg.createdAt).toLocaleTimeString()})</span>
                          </div>
                          <p className="text-xs text-slate-600 font-mono">"{msg.raw_message}"</p>
                        </div>
                        
                        {msg.status === 'Pending' && (
                          <button
                            onClick={() => handleIngestSms(msg.id)}
                            className="bg-indigo-600 hover:bg-indigo-505 text-white font-bold text-[9px] uppercase tracking-wider px-3.5 py-2.5 rounded-xl transition shrink-0 shadow-md shadow-indigo-100 font-mono"
                          >
                            ⚡ Parse via AI
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
 
            </div>
          ) : displayedRequests.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-slate-400">
              No {activeTab === 'active' ? 'active' : ''} telemetry incidents found in this view.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[9px] font-bold uppercase tracking-widest border-b border-slate-200">
                    <th className="p-4">ID</th>
                    <th className="p-4">Incident details</th>
                    <th className="p-4 text-center">AI Priority</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Dispatch Unit</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {displayedRequests.map((req) => {
                    const isReviewNeeded = req.EmergencyAnalysis?.requires_human_review;
                    const priority = req.EmergencyAnalysis?.priority;
                    const priorityStyle = 
                      priority === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                      priority === 'High' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-slate-100 text-slate-600 border-slate-200';
 
                    return (
                      <tr key={req.id} className={`hover:bg-slate-50/50 transition duration-75 ${isReviewNeeded ? 'bg-amber-50/20' : ''}`}>
                        <td className="p-4 font-mono text-[11px] text-slate-400">#{req.id}</td>
                        <td className="p-4 max-w-sm">
                          <div className="flex items-center gap-2 font-semibold text-slate-800">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">{req.category}</span>
                            <span className="text-[10px] text-slate-400">({req.people_count} Trapped)</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">{req.description}</p>
                          {req.EmergencyAnalysis?.translated_description && (
                            <div className="mt-1 text-[10px] bg-indigo-50/50 border border-indigo-150 rounded p-1.5 text-indigo-700 italic">
                              📝 <span>Translated (EN):</span> "{req.EmergencyAnalysis.translated_description}"
                            </div>
                          )}
                          {req.EmergencyAnalysis?.image_tags && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {req.EmergencyAnalysis.image_tags.split(',').map((tag, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono text-[9px]">
                                  #{tag.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] font-mono text-slate-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
                            📍 Location: 
                            <button 
                              onClick={() => setSelectedMapRequest(req)}
                              className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded text-[9px] font-semibold flex items-center gap-1 transition shadow-sm"
                            >
                              🗺️ View Command Map ({parseFloat(req.latitude).toFixed(4)}, {parseFloat(req.longitude).toFixed(4)})
                            </button>
                            {req.landmark && ` (Landmark: ${req.landmark})`}
                          </p>
                          {req.image_path && (
                            <div className="mt-1.5 max-w-[80px] rounded border border-slate-200 overflow-hidden bg-slate-50">
                              <img 
                                src={`http://localhost:5000${req.image_path}`} 
                                alt="Evidence" 
                                className="w-full h-auto max-h-[50px] object-cover cursor-zoom-in"
                                onClick={() => window.open(`http://localhost:5000${req.image_path}`, '_blank')}
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {req.EmergencyAnalysis ? (
                            <div className="flex flex-col items-center justify-center space-y-0.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityStyle}`}>
                                  {req.EmergencyAnalysis.priority}
                              </span>
                              <span className="text-[9px] font-mono text-slate-400">Conf: {req.EmergencyAnalysis.confidence}%</span>
                            </div>
                          ) : <span className="text-slate-400">Unanalyzed</span>}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${req.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : req.status === 'Assigned' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {req.status === 'Under Analysis' ? (
                            <button
                              onClick={() => handleVerifyRequest(req.id)}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md border border-indigo-200 text-[10px] font-semibold transition shadow-sm whitespace-nowrap"
                            >
                              ✓ Verify AI Triage
                            </button>
                          ) : req.status === 'Completed' ? (
                            <span className="text-emerald-600 font-semibold text-[10px]">Sector Secured</span>
                          ) : req.status === 'Assigned' && req.Assignments && req.Assignments.length > 0 ? (
                            <div className="text-[10px] text-slate-500 space-y-1 text-left">
                              <span className="font-semibold text-slate-700 block">Dispatched Units:</span>
                              <div className="flex flex-wrap gap-1">
                                {req.Assignments.map((asg, idx) => (
                                  <span key={asg.id || idx} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-mono text-[9px] whitespace-nowrap">
                                    {asg.department} ({asg.User?.name || 'Unit'})
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 items-start justify-center min-w-[200px]">
                              <div className="flex flex-col gap-1 w-full">
                                <div className="flex items-center gap-2 w-full">
                                  <select
                                    value={dispatchState[req.id]?.responderId || ''}
                                    onChange={e => setRowDispatch(req.id, 'responderId', e.target.value)}
                                    className="bg-white border border-slate-200 text-[10px] rounded p-1 focus:border-slate-400 outline-none w-full"
                                  >
                                    <option value="">Select Unit</option>
                                    {responders.map(r => (
                                      <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                  </select>
 
                                  <button
                                    onClick={() => handleAssignResponder(req.id)}
                                    className="bg-slate-900 hover:bg-slate-800 text-white text-[9px] font-bold px-3 py-1.5 rounded transition whitespace-nowrap shadow-sm"
                                  >
                                    Dispatch
                                  </button>
                                </div>
                                {(() => {
                                  const rec = getRecommendedResponder(req.category);
                                  return rec ? (
                                    <button 
                                      type="button"
                                      onClick={() => setRowDispatch(req.id, 'responderId', rec.id.toString())}
                                      className="text-[9px] text-left text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded px-1.5 py-0.5 w-fit font-semibold flex items-center gap-1 transition"
                                    >
                                      💡 AI Suggested: {rec.name} (Load: {rec.activeMissionsCount || 0})
                                    </button>
                                  ) : null;
                                })()}
                              </div>
 
                              <div className="flex flex-wrap gap-1 w-full border border-dashed border-slate-200 rounded p-1 bg-slate-50/50">
                                {['Police', 'Fire Force', 'Paramedic', 'Disaster Response', 'Volunteer'].map(dept => {
                                  const isSelected = (dispatchState[req.id]?.departments || []).includes(dept);
                                  return (
                                    <button
                                      key={dept}
                                      onClick={() => toggleDepartment(req.id, dept)}
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition ${
                                        isSelected 
                                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                          : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200'
                                      }`}
                                    >
                                      {dept}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleOverridePriority(req.id, req.EmergencyAnalysis?.priority)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded-md border border-slate-200 text-[10px] font-semibold transition whitespace-nowrap"
                          >
                            ⚡ Priority
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
 
      {selectedMapRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl w-full max-w-2xl relative flex flex-col space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-450 font-mono">Incident command vector</span>
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 mt-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                  #{selectedMapRequest.id} - {selectedMapRequest.category}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedMapRequest(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm transition"
              >
                ✕
              </button>
            </div>
 
            <div className="text-xs text-slate-650 bg-slate-50 border border-slate-100 p-3 rounded-xl font-mono leading-relaxed">
              <span className="font-bold text-slate-800">Telemetry Info:</span> {selectedMapRequest.description}
              {selectedMapRequest.landmark && (
                <div className="mt-1">📍 <span className="font-bold text-slate-800">Landmark:</span> {selectedMapRequest.landmark}</div>
              )}
            </div>
 
            <div className="w-full h-[350px] border border-slate-200 rounded-2xl overflow-hidden relative shadow-inner">
              <div id="modal-map-container" className="w-full h-full z-10"></div>
            </div>
            
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <h4 className="font-bold text-[10px] uppercase text-slate-400 tracking-wider font-mono">Incident Action Audit Trail</h4>
              {selectedMapLogs.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic font-mono">No action records retrieved for this vector.</p>
              ) : (
                <div className="space-y-2.5 max-h-[150px] overflow-y-auto pr-1">
                  {selectedMapLogs.map((log, idx) => (
                    <div key={log.id || idx} className="flex gap-3 text-[10px] leading-relaxed items-start">
                      <span className="font-mono text-slate-400 shrink-0">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-1.5 py-0.5 rounded-full font-bold uppercase text-[7.5px] border ${
                          log.action === 'Reported' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          log.action === 'Auto-Assigned' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                          log.action === 'Dispatched' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                          log.action === 'Priority Override' ? 'bg-red-50 text-red-700 border-red-100' :
                          log.action === 'Status Updated' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-slate-50 text-slate-700 border-slate-100'
                        }`}>
                          {log.action}
                        </span>
                      </div>
                      <span className="text-slate-600 font-mono">{log.details}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100 pt-2">
              <span>COORDS: {parseFloat(selectedMapRequest.latitude).toFixed(5)}, {parseFloat(selectedMapRequest.longitude).toFixed(5)}</span>
              <span>PRIORITY: <strong className="text-slate-700">{selectedMapRequest.EmergencyAnalysis?.priority || 'Medium'}</strong></span>
            </div>
 
          </div>
        </div>
      )}
    </div>
  );
}