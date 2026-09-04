'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { getDashboardImpactApi } from '@/lib/api/dashboard';
import { getFuelSharesApi } from '@/lib/api/fuelShare';
import { getVehiclesApi } from '@/lib/api/vehicle';
import { DashboardResponse, FuelShare, Vehicle } from '@/lib/api/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [fuelShares, setFuelShares] = useState<FuelShare[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [dashData, tripsData, vehiclesData] = await Promise.all([
          getDashboardImpactApi(),
          getFuelSharesApi(),
          getVehiclesApi(),
        ]);
        setDashboard(dashData);
        setFuelShares(tripsData);
        setVehicles(vehiclesData);
      } catch (err: any) {
        setError(err.detail || err.message || 'Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const metrics = dashboard?.metrics || {
    total_money_saved_rupees: 0,
    total_fuel_saved_litres: 0,
    total_co2_reduced_kg: 0,
    completed_shared_trips: 0,
    total_participants: 0,
  };

  return (
    <ProtectedRoute>
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Header Welcome Banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-200">
              Commuter Impact Dashboard
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
              Welcome back, {user?.name || 'Commuter'} 👋
            </h1>
            <p className="text-sm text-emerald-100 mt-1">
              Real-time fuel sharing savings, environmental impact, and trip management.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/fuel-shares/create">
              <Button className="bg-white hover:bg-emerald-50 text-emerald-800 font-bold shadow">
                + Offer Trip
              </Button>
            </Link>
            <Link href="/fuel-shares">
              <Button variant="secondary" className="bg-emerald-800/60 hover:bg-emerald-800 text-white font-bold">
                🔍 Find Trips
              </Button>
            </Link>
          </div>
        </div>

        {error && <ErrorAlert message={error} />}

        {/* Quick Actions Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/fuel-shares/create">
            <div className="p-4 bg-white border border-slate-200 hover:border-emerald-500 rounded-2xl shadow-sm hover:shadow transition-all text-center group cursor-pointer">
              <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">🚗</div>
              <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-600">Offer Trip</span>
            </div>
          </Link>

          <Link href="/fuel-shares">
            <div className="p-4 bg-white border border-slate-200 hover:border-teal-500 rounded-2xl shadow-sm hover:shadow transition-all text-center group cursor-pointer">
              <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">🔍</div>
              <span className="text-xs font-bold text-slate-800 group-hover:text-teal-600">Find Trips</span>
            </div>
          </Link>

          <Link href="/my-trips">
            <div className="p-4 bg-white border border-slate-200 hover:border-indigo-500 rounded-2xl shadow-sm hover:shadow transition-all text-center group cursor-pointer">
              <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">🎫</div>
              <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">My Trips</span>
            </div>
          </Link>

          <Link href="/vehicles">
            <div className="p-4 bg-white border border-slate-200 hover:border-purple-500 rounded-2xl shadow-sm hover:shadow transition-all text-center group cursor-pointer">
              <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">⚙️</div>
              <span className="text-xs font-bold text-slate-800 group-hover:text-purple-600">My Vehicles</span>
            </div>
          </Link>
        </div>

        {/* Real Impact Cards (4 Stat Cards) */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center space-x-2">
            <span>🌱 Environmental & Financial Impact</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Money Saved */}
            <Card className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white border-none shadow-lg">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">Money Saved</span>
                <p className="text-3xl font-black">₹{metrics.total_money_saved_rupees.toFixed(2)}</p>
                <p className="text-[11px] text-emerald-100">Calculated equal fuel cost sharing</p>
              </div>
            </Card>

            {/* Fuel Saved */}
            <Card className="bg-gradient-to-br from-teal-600 to-cyan-700 text-white border-none shadow-lg">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-teal-100 uppercase tracking-wider">Est. Fuel Saved</span>
                <p className="text-3xl font-black">{metrics.total_fuel_saved_litres} L</p>
                <p className="text-[11px] text-teal-100">Based on vehicle mileage & distance</p>
              </div>
            </Card>

            {/* CO2 Reduced */}
            <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-none shadow-lg">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-indigo-100 uppercase tracking-wider">Est. CO₂ Reduced</span>
                <p className="text-3xl font-black">{metrics.total_co2_reduced_kg} kg</p>
                <p className="text-[11px] text-indigo-100">2.31 kg CO₂ / Litre fuel saved</p>
              </div>
            </Card>

            {/* Shared Trips */}
            <Card className="bg-gradient-to-br from-slate-800 to-slate-950 text-white border-none shadow-lg">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Shared Trips</span>
                <p className="text-3xl font-black">{metrics.completed_shared_trips}</p>
                <p className="text-[11px] text-slate-400">{metrics.total_participants} Total Participants</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Activity Feed & Available Trips Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Activity Feed */}
          <Card title="Recent Activity Feed" subtitle="Real-time activity across your Fuel Share offers & requests">
            {loading ? (
              <LoadingSpinner message="Loading activity feed..." />
            ) : !dashboard?.recent_activity || dashboard.recent_activity.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-slate-500">No recent activity recorded yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Offer a trip or join a compatible route to start!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboard.recent_activity.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-900">{item.title}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{item.description}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Available Trips List */}
          <Card title="Available Fuel Shares" subtitle="Active commuter offers open for join requests">
            {loading ? (
              <LoadingSpinner message="Fetching trips..." />
            ) : fuelShares.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-xs text-slate-500">No active trips available right now.</p>
                <Link href="/fuel-shares/create">
                  <Button size="sm" variant="secondary">
                    + Offer First Trip
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {fuelShares.slice(0, 3).map((trip) => (
                  <div
                    key={trip.id}
                    className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 text-sm">
                        {trip.source_name} → {trip.destination_name}
                      </span>
                      <div className="text-slate-500 mt-0.5">
                        📅 {trip.departure_date} at {trip.departure_time} • 💺 {trip.available_seats} seats remaining
                      </div>
                    </div>
                    <Link href={`/fuel-shares/${trip.id}`}>
                      <Button variant="outline" size="sm">
                        View Trip
                      </Button>
                    </Link>
                  </div>
                ))}
                <div className="pt-2 text-right">
                  <Link href="/fuel-shares" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                    View All Active Trips →
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
