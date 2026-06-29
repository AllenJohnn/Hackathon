import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function AdminDashboard() {
  const { logout, user } = useContext(AuthContext);
  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-xl">
        <h2 className="text-2xl font-bold text-slate-900">ResQNet Tactical Command Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">Operator: {user?.name} (Systems Administrator Node)</p>
        <div className="my-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          🚧 Command interface framework loading telemetry monitors...
        </div>
        <button onClick={logout} className="bg-red-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-red-700 transition">
          Terminate Session
        </button>
      </div>
    </div>
  );
}