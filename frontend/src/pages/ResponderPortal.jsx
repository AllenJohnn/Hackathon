import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function ResponderPortal() {
  const { logout, user } = useContext(AuthContext);
  return (
    <div className="p-8">
      <div className="bg-white p-6 rounded-xl shadow-md max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-blue-600 mb-2">ResQNet Field Responder Node</h1>
        <p className="text-slate-600 mb-4">Welcome back, officer {user?.name}. Active rescue vectors will populate below.</p>
        <button onClick={logout} className="bg-slate-800 text-white px-4 py-2 rounded text-sm hover:bg-slate-900">
          Disconnect Radio Terminal
        </button>
      </div>
    </div>
  );
}