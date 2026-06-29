import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Activity, ShieldAlert, CheckCircle, Radio, Clock } from 'lucide-react';

export default function AdminDashboard() {
  const { token, logout, user } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [responders, setResponders] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'all'
  const [dispatchState, setDispatchState] = useState({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, critical: 0, completed: 0 });

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
      console.error('Failed to capture tactical operations arrays.', err);
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
      console.error('Failed to capture responders registry.', err);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchResponders();
    const interval = setInterval(fetchRequests, 8000);
    return () => clearInterval(interval);
  }, []);

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

  const handleAssignResponder = async (requestId) => {
    const state = dispatchState[requestId];
    const responderId = state?.responderId;
    const department = state?.department;

    if (!responderId || !department) {
      alert('Please select both a Responder Unit and a Department.');
      return;
    }

    try {
      await axios.post('http://localhost:5000/api/admin/assignments', {
        request_id: requestId,
        responder_id: parseInt(responderId),
        department
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Emergency request dispatched and routed successfully.');
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Dispatch routing failed.');
    }
  };

  const handleVerifyRequest = async (id) => {
    try {
      await axios.put(`http://localhost:5000/api/admin/requests/${id}/verify`, { status: 'Verified' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchRequests();
    } catch (err) {
      alert('Failed to verify request.');
    }
  };

  const displayedRequests = requests.filter(req => {
    if (activeTab === 'active') {
      return req.status !== 'Completed';
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* HEADER */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Radio className="text-red-500 animate-pulse" size={20} />
            <span className="font-mono text-xs tracking-wider uppercase text-slate-800 font-bold">
              ResQNet Command Desk
            </span>
          </div>
          <button onClick={logout} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition">
            Disconnect Terminal
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        
        {/* STATS TILES */}
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
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Critical Dangers</p>
              <p className="text-2xl font-black mt-1 text-red-600">{stats.critical}</p>
            </div>
            <ShieldAlert className="text-red-500" size={24} />
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-2xl flex justify-between items-center shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Closed Vectors</p>
              <p className="text-2xl font-black mt-1 text-emerald-600">{stats.completed}</p>
            </div>
            <CheckCircle className="text-emerald-500" size={24} />
          </div>
        </div>

        {/* DATA GRID */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-150 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h3 className="font-bold text-xs text-slate-700 uppercase tracking-widest">Live Ingestion Matrix</h3>
            
            {/* Tabs Selector Switcher */}
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 w-full sm:max-w-xs text-[10px]">
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
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs font-mono text-slate-400">Accessing tracking registries...</div>
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
                          <p className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-1">
                            📍 Map: <a href={`https://www.openstreetmap.org/?mlat=${req.latitude}&mlon=${req.longitude}#map=17/${req.latitude}/${req.longitude}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold">
                              {parseFloat(req.latitude).toFixed(4)}, {parseFloat(req.longitude).toFixed(4)}
                            </a>
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
                            <div className="text-[10px] text-slate-500">
                              Dispatched: <span className="font-semibold text-slate-700">{req.Assignments[req.Assignments.length - 1].User?.name}</span> ({req.Assignments[req.Assignments.length - 1].department})
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <select
                                value={dispatchState[req.id]?.responderId || ''}
                                onChange={e => setRowDispatch(req.id, 'responderId', e.target.value)}
                                className="bg-white border border-slate-200 text-[10px] rounded p-1 focus:border-slate-400 outline-none"
                              >
                                <option value="">Select Unit</option>
                                {responders.map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>

                              <select
                                value={dispatchState[req.id]?.department || ''}
                                onChange={e => setRowDispatch(req.id, 'department', e.target.value)}
                                className="bg-white border border-slate-200 text-[10px] rounded p-1 focus:border-slate-400 outline-none"
                              >
                                <option value="">Select Dept</option>
                                <option value="Police">Police</option>
                                <option value="Fire Force">Fire Force</option>
                                <option value="Paramedic">Paramedic</option>
                                <option value="Disaster Response">Disaster Response</option>
                                <option value="Volunteer">Volunteer</option>
                              </select>

                              <button
                                onClick={() => handleAssignResponder(req.id)}
                                className="bg-slate-900 hover:bg-slate-800 text-white text-[9px] font-bold px-2 py-1 rounded transition whitespace-nowrap"
                              >
                                Dispatch
                              </button>
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
    </div>
  );
}