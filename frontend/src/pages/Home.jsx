import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between font-sans selection:bg-slate-200">
      
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 rounded-lg border border-slate-200">
              <Shield className="text-slate-700" size={16} />
            </div>
            <span className="font-mono text-xs tracking-wider text-slate-700 uppercase font-bold">
              ResQNet Portal
            </span>
          </div>

          <div>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-[10px] font-mono rounded-full text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              SYSTEM ONLINE
            </span>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="flex-1 max-w-md w-full mx-auto px-6 py-20 flex flex-col justify-center gap-8">
        
        {/* Intro Text */}
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Emergency Dispatch & Beacon Gateway
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
            A resilient coordination network linking offline-first distress signals with central AI triage models to streamline regional emergency services.
          </p>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3.5 px-4 rounded-xl transition duration-150 text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-slate-200/50"
          >
            Access Gateway Console
            <ArrowRight size={14} className="text-slate-400" />
          </button>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 py-6 bg-white">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] font-mono text-slate-400">
          <div>
            &copy; 2026 ResQNet. Operational Node.
          </div>
          <div className="flex gap-4">
            <span className="hover:text-slate-600 cursor-pointer transition">SECURITY PROTOCOLS</span>
            <span>|</span>
            <span className="hover:text-slate-600 cursor-pointer transition">SYSTEM METRICS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}