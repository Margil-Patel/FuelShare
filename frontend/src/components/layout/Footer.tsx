import React from 'react';
import Link from 'next/link';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 text-sm py-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center text-white font-black text-base">
                F
              </div>
              <span className="font-extrabold text-lg tracking-tight text-white">
                Fuel<span className="text-indigo-400">Share</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Smart ride-matching and equal fuel cost sharing platform for sustainable everyday commutes.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white mb-3 text-xs uppercase tracking-wider">Product</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/fuel-shares" className="hover:text-indigo-400 transition-colors">Find Fuel Share</Link></li>
              <li><Link href="/fuel-shares/create" className="hover:text-indigo-400 transition-colors">Offer a Ride</Link></li>
              <li><Link href="/dashboard" className="hover:text-indigo-400 transition-colors">Dashboard</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-3 text-xs uppercase tracking-wider">Account</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/login" className="hover:text-indigo-400 transition-colors">Log In</Link></li>
              <li><Link href="/register" className="hover:text-indigo-400 transition-colors">Sign Up</Link></li>
              <li><Link href="/vehicles" className="hover:text-indigo-400 transition-colors">My Vehicles</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-3 text-xs uppercase tracking-wider">Tech Stack</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Built with Next.js, Tailwind CSS, FastAPI, PostgreSQL & SQLAlchemy.
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} FuelShare. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
