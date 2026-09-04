'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { FuelShareCard } from '@/components/fuel-shares/FuelShareCard';
import { FuelShareStatusBadge } from '@/components/fuel-shares/FuelShareStatus';
import { getMyFuelSharesApi, deleteFuelShareApi } from '@/lib/api/fuelShare';
import { getMyJoinRequestsApi, cancelJoinRequestApi } from '@/lib/api/joinRequest';
import { FuelShare, JoinRequest } from '@/lib/api/types';
import { useAuth } from '@/context/AuthContext';

export default function MyTripsPage() {
  const { user } = useAuth();

  const [mainTab, setMainTab] = useState<'CREATED' | 'JOINED'>('CREATED');
  const [createdTrips, setCreatedTrips] = useState<FuelShare[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancel Trip Dialog (for created trips)
  const [cancelTripId, setCancelTripId] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Cancel Request Dialog (for joined requests)
  const [cancelRequestId, setCancelRequestId] = useState<number | null>(null);
  const [cancelReqLoading, setCancelReqLoading] = useState(false);

  const fetchAllTrips = async () => {
    setLoading(true);
    setError(null);
    try {
      const [offered, joined] = await Promise.all([
        getMyFuelSharesApi(),
        getMyJoinRequestsApi(),
      ]);
      setCreatedTrips(offered);
      setJoinRequests(joined);
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load your trips.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAllTrips();
    }
  }, [user]);

  const handleConfirmCancelTrip = async () => {
    if (!cancelTripId) return;
    setCancelLoading(true);
    try {
      await deleteFuelShareApi(cancelTripId);
      setCancelTripId(null);
      fetchAllTrips();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to cancel trip.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleConfirmCancelRequest = async () => {
    if (!cancelRequestId) return;
    setCancelReqLoading(true);
    try {
      await cancelJoinRequestApi(cancelRequestId);
      setCancelRequestId(null);
      fetchAllTrips();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to cancel join request.');
    } finally {
      setCancelReqLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Trips</h1>
            <p className="text-sm text-slate-500 mt-1">
              Track trips you have created or joined as a passenger.
            </p>
          </div>
          <Link href="/fuel-shares/create">
            <Button variant="primary">+ Offer New Trip</Button>
          </Link>
        </div>

        {error && <ErrorAlert message={error} onRetry={fetchAllTrips} />}

        {/* Main Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-4">
          <button
            onClick={() => setMainTab('CREATED')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${
              mainTab === 'CREATED'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            🚗 Offered Trips ({createdTrips.length})
          </button>
          <button
            onClick={() => setMainTab('JOINED')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${
              mainTab === 'JOINED'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            🎫 Joined / Requested Trips ({joinRequests.length})
          </button>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading trip history..." />
        ) : mainTab === 'CREATED' ? (
          /* Created Trips Section */
          createdTrips.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-base font-bold text-slate-700">No offered trips found.</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                You haven&apos;t created any Fuel Share offers yet.
              </p>
              <Link href="/fuel-shares/create">
                <Button size="sm" variant="secondary">
                  + Offer a Trip Now
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {createdTrips.map((trip) => (
                <FuelShareCard
                  key={trip.id}
                  trip={trip}
                  currentUserId={user?.id}
                  onCancel={(id) => setCancelTripId(id)}
                />
              ))}
            </div>
          )
        ) : (
          /* Joined Trips Section */
          joinRequests.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-base font-bold text-slate-700">No joined trips found.</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Browse available Fuel Shares to request to join a trip.
              </p>
              <Link href="/fuel-shares">
                <Button size="sm" variant="secondary">
                  Find Available Trips
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-4">
              {joinRequests.map((req) => {
                const trip = req.fuel_share;
                return (
                  <Card key={req.id} className="hover:border-indigo-200 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-lg">
                            {trip ? `${trip.source_name} → ${trip.destination_name}` : `Trip #${req.fuel_share_id}`}
                          </span>
                          <FuelShareStatusBadge status={req.status} />
                        </div>

                        {trip && (
                          <div className="text-xs text-slate-600 space-y-0.5">
                            <div>
                              📅 <span className="font-semibold">{trip.departure_date}</span> at{' '}
                              <span className="font-semibold">{trip.departure_time}</span>
                            </div>
                            <div>
                              💺 Available Seats: <span className="font-bold text-emerald-600">{trip.available_seats} remaining</span> • Est. Cost: ₹{trip.estimated_fuel_cost}
                            </div>
                          </div>
                        )}

                        <div className="text-[11px] text-slate-400">
                          Requested on {new Date(req.requested_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-end">
                        {req.status === 'ACCEPTED' && (
                          <Link href={`/fuel-shares/${req.fuel_share_id}`}>
                            <Button variant="primary" size="sm">
                              💳 Pay Contribution
                            </Button>
                          </Link>
                        )}

                        {req.status === 'PENDING' && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setCancelRequestId(req.id)}
                          >
                            Cancel Request
                          </Button>
                        )}

                        <Link href={`/fuel-shares/${req.fuel_share_id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {/* Confirmation Dialog for Created Trip Cancel */}
        <ConfirmDialog
          isOpen={cancelTripId !== null}
          title="Cancel Fuel Share Offer"
          message="Are you sure you want to cancel this trip offer? Trip status will become CANCELLED."
          confirmText="Yes, Cancel Trip"
          cancelText="Keep Trip"
          isLoading={cancelLoading}
          onConfirm={handleConfirmCancelTrip}
          onCancel={() => setCancelTripId(null)}
        />

        {/* Confirmation Dialog for Join Request Cancel */}
        <ConfirmDialog
          isOpen={cancelRequestId !== null}
          title="Cancel Join Request"
          message="Are you sure you want to cancel your pending join request for this trip?"
          confirmText="Yes, Cancel Request"
          cancelText="Keep Request"
          isLoading={cancelReqLoading}
          onConfirm={handleConfirmCancelRequest}
          onCancel={() => setCancelRequestId(null)}
        />
      </div>
    </ProtectedRoute>
  );
}
