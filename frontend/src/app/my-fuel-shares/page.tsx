'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { FuelShareCard } from '@/components/fuel-shares/FuelShareCard';
import { getMyFuelSharesApi, updateFuelShareApi, deleteFuelShareApi } from '@/lib/api/fuelShare';
import { FuelShare } from '@/lib/api/types';
import { useAuth } from '@/context/AuthContext';

export default function MyFuelSharesPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<FuelShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'FULL' | 'COMPLETED' | 'CANCELLED'>('ALL');

  // Cancel dialog state
  const [cancelTripId, setCancelTripId] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Edit Modal state
  const [editingTrip, setEditingTrip] = useState<FuelShare | null>(null);
  const [editForm, setEditForm] = useState({
    source_name: '',
    destination_name: '',
    departure_date: '',
    departure_time: '',
    available_seats: 1,
    estimated_fuel_cost: 0,
  });
  const [editLoading, setEditLoading] = useState(false);

  const fetchMyTrips = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyFuelSharesApi();
      setTrips(data);
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load your trips.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMyTrips();
    }
  }, [user]);

  const handleOpenCancelDialog = (tripId: number) => {
    setCancelTripId(tripId);
  };

  const handleConfirmCancel = async () => {
    if (!cancelTripId) return;
    setCancelLoading(true);
    try {
      await deleteFuelShareApi(cancelTripId);
      setCancelTripId(null);
      fetchMyTrips();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to cancel Fuel Share trip.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleOpenEdit = (trip: FuelShare) => {
    setEditingTrip(trip);
    setEditForm({
      source_name: trip.source_name,
      destination_name: trip.destination_name,
      departure_date: trip.departure_date,
      departure_time: trip.departure_time,
      available_seats: trip.available_seats,
      estimated_fuel_cost: trip.estimated_fuel_cost,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrip) return;
    setEditLoading(true);
    setError(null);
    try {
      await updateFuelShareApi(editingTrip.id, {
        source_name: editForm.source_name,
        destination_name: editForm.destination_name,
        departure_date: editForm.departure_date,
        departure_time: editForm.departure_time.length === 5 ? `${editForm.departure_time}:00` : editForm.departure_time,
        available_seats: Number(editForm.available_seats),
        estimated_fuel_cost: Number(editForm.estimated_fuel_cost),
      });
      setEditingTrip(null);
      fetchMyTrips();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to update Fuel Share.');
    } finally {
      setEditLoading(false);
    }
  };

  const filteredTrips = trips.filter((t) => {
    if (activeTab === 'ALL') return true;
    return t.status === activeTab;
  });

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Offered Trips</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your created Fuel Share offers, view statuses, edit schedule, or cancel trips.
            </p>
          </div>
          <Link href="/fuel-shares/create">
            <Button variant="primary">+ Offer New Trip</Button>
          </Link>
        </div>

        {error && <ErrorAlert message={error} onRetry={fetchMyTrips} />}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {(['ALL', 'ACTIVE', 'FULL', 'COMPLETED', 'CANCELLED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab === 'ALL' ? 'All Trips' : tab} (
              {tab === 'ALL' ? trips.length : trips.filter((t) => t.status === tab).length})
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingSpinner message="Loading your created trips..." />
        ) : filteredTrips.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-base font-bold text-slate-700">No trips found in this category.</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              {activeTab === 'ALL'
                ? "You haven't posted any Fuel Shares yet."
                : `You don't have any ${activeTab} trips.`}
            </p>
            <Link href="/fuel-shares/create">
              <Button size="sm" variant="secondary">
                + Create Fuel Share Offer
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredTrips.map((trip) => (
              <FuelShareCard
                key={trip.id}
                trip={trip}
                currentUserId={user?.id}
                onCancel={handleOpenCancelDialog}
                onEdit={handleOpenEdit}
              />
            ))}
          </div>
        )}

        {/* Confirmation Modal for Cancel */}
        <ConfirmDialog
          isOpen={cancelTripId !== null}
          title="Cancel Fuel Share Trip"
          message="Are you sure you want to cancel this Fuel Share offer? This action will set the trip status to CANCELLED."
          confirmText="Yes, Cancel Trip"
          cancelText="Keep Trip"
          isLoading={cancelLoading}
          onConfirm={handleConfirmCancel}
          onCancel={() => setCancelTripId(null)}
        />

        {/* Edit Modal */}
        {editingTrip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Edit Fuel Share #{editingTrip.id}</h3>
                <button
                  onClick={() => setEditingTrip(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                <Input
                  label="Pickup Location Name"
                  value={editForm.source_name}
                  onChange={(e) => setEditForm({ ...editForm, source_name: e.target.value })}
                  required
                />

                <Input
                  label="Destination Location Name"
                  value={editForm.destination_name}
                  onChange={(e) => setEditForm({ ...editForm, destination_name: e.target.value })}
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Departure Date"
                    type="date"
                    value={editForm.departure_date}
                    onChange={(e) => setEditForm({ ...editForm, departure_date: e.target.value })}
                    required
                  />
                  <Input
                    label="Departure Time"
                    type="time"
                    value={editForm.departure_time}
                    onChange={(e) => setEditForm({ ...editForm, departure_time: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Available Seats"
                    type="number"
                    min={1}
                    value={editForm.available_seats}
                    onChange={(e) => setEditForm({ ...editForm, available_seats: Number(e.target.value) })}
                    required
                  />
                  <Input
                    label="Est. Fuel Cost (₹)"
                    type="number"
                    min={1}
                    value={editForm.estimated_fuel_cost}
                    onChange={(e) => setEditForm({ ...editForm, estimated_fuel_cost: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingTrip(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" isLoading={editLoading}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
