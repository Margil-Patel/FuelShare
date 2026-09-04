'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-16 py-6">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto space-y-6 pt-4">
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide">
          ⚡ Smart Fuel Cost Sharing Platform
        </div>
        <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-tight">
          Share Your Ride, <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 bg-clip-text text-transparent">
            Split Fuel Costs Fairly
          </span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Connect with commuters traveling your route. Share empty vehicle seats, save up to 75% on daily fuel expenses, and cut carbon emissions.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          {user ? (
            <Link href="/dashboard">
              <Button size="lg">Go to Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/register">
                <Button size="lg">Get Started Free</Button>
              </Link>
              <Link href="/fuel-shares">
                <Button variant="outline" size="lg">
                  Find Fuel Share
                </Button>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Highlights Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:border-indigo-200 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl mb-4">
            📍
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Smart Route Matching</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Our rule-based engine evaluates origin, destination proximity, and departure time windows to suggest optimal trip matches.
          </p>
        </Card>

        <Card className="hover:border-indigo-200 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl mb-4">
            ⛽
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Transparent Cost Split</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Automated fuel cost calculations based on actual vehicle mileage, distance, and participant count with zero hidden fees.
          </p>
        </Card>

        <Card className="hover:border-indigo-200 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xl mb-4">
            🔒
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Verified Participants</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Trip creators review and approve incoming join requests to ensure safe, reliable, and comfortable commuting.
          </p>
        </Card>
      </section>

      {/* Quick CTA Card */}
      <section className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold">Ready to start saving on fuel?</h2>
          <p className="text-indigo-200 text-sm max-w-xl">
            Join FuelShare today to create your first trip or find a matching ride in seconds.
          </p>
        </div>
        <Link href={user ? '/fuel-shares/create' : '/register'}>
          <Button variant="secondary" size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold">
            {user ? 'Create Fuel Share' : 'Create Account'}
          </Button>
        </Link>
      </section>
    </div>
  );
}
