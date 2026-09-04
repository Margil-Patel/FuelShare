'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { FuelShareStatusBadge } from '@/components/fuel-shares/FuelShareStatus';
import { getMyJoinRequestsApi, cancelJoinRequestApi } from '@/lib/api/joinRequest';
import { getMyRideRequestsApi, cancelRideRequestApi } from '@/lib/api/rideRequest';
import { JoinRequest, RideRequest } from '@/lib/api/types';
import { useAuth } from '@/context/AuthContext';

export default function MyRequestsPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'JOIN_REQUESTS' | 'ROUTE_REQUESTS'>('JOIN_REQUESTS');
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancel Join Request State
  const [cancelJoinId, setCancelJoinId] = useState<number | null>(null);
  const [cancelJoinLoading, setCancelJoinLoading] = useState(false);

  // Cancel Route Request State
  const [cancelRideId, setCancelRideId] = useState<number | null>(null);
  const [cancelRideLoading, setCancelRideLoading] = useState(false);

  const fetchAllRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const [joined, routes] = await Promise.all([
        getMyJoinRequestsApi(),
        getMyRideRequestsApi(),
      ]);
      setJoinRequests(joined);
      setRideRequests(routes);
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load your requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAllRequests();
    }
  }, [user]);

  const handleConfirmCancelJoin = async () => {
    if (!cancelJoinId) return;
    setCancelJoinLoading(true);
    try {
      await cancelJoinRequestApi(cancelJoinId);
      setCancelJoinId(null);
      fetchAllRequests();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to cancel join request.');
    } finally {
      setCancelJoinLoading(false);
    }
  };

  const handleConfirmCancelRide = async () => {
    if (!cancelRideId) return;
    setCancelRideLoading(true);
    try {
      await cancelRideRequestApi(cancelRideId);
      setCancelRideId(null);
      fetchAllRequests();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to cancel route request.');
    } finally {
      setCancelRideLoading(false);
    }
  };

  const pendingJoinCount = joinRequests.filter((r) => r.status === 'PENDING').length;
  const acceptedJoinCount = joinRequests.filter((r) => r.status === 'ACCEPTED').length;
  const openRideCount = rideRequests.filter((r) => r.status === 'OPEN').length;

  return (
    <ProtectedRoute>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              📋 My Passenger Requests
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Track all your join requests and route searches submitted as a passenger.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/corridor-matches">
              <Button variant="primary" size="sm">
                🗺️ Find by Route
              </Button>
            </Link>
            <Link href="/fuel-shares">
              <Button variant="outline" size="sm">
                🔍 Browse All Trips
              </Button>
            </Link>
          </div>
        </div>

        {/* Overview Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-slate-50 border-slate-200">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
              Total Requests
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              {joinRequests.length + rideRequests.length}
            </span>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <span className="text-xs text-amber-700 font-semibold uppercase tracking-wider block">
              Pending Approval
            </span>
            <span className="text-2xl font-black text-amber-900 mt-1 block">
              {pendingJoinCount}
            </span>
          </Card>

          <Card className="bg-emerald-50 border-emerald-200">
            <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider block">
              Accepted Rides
            </span>
            <span className="text-2xl font-black text-emerald-900 mt-1 block">
              {acceptedJoinCount}
            </span>
          </Card>

          <Card className="bg-indigo-50 border-indigo-200">
            <span className="text-xs text-indigo-700 font-semibold uppercase tracking-wider block">
              Route Requests
            </span>
            <span className="text-2xl font-black text-indigo-900 mt-1 block">
              {openRideCount}
            </span>
          </Card>
        </div>

        {error && <ErrorAlert message={error} onRetry={fetchAllRequests} />}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-4">
          <button
            onClick={() => setActiveTab('JOIN_REQUESTS')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'JOIN_REQUESTS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🎫 Trip Join Requests</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              {joinRequests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ROUTE_REQUESTS')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'ROUTE_REQUESTS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🛣️ Route Corridor Requests</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              {rideRequests.length}
            </span>
          </button>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading your passenger requests..." />
        ) : activeTab === 'JOIN_REQUESTS' ? (
          /* Join Requests List */
          joinRequests.length === 0 ? (
            <Card className="text-center py-12 space-y-3">
              <div className="text-4xl">🎫</div>
              <p className="text-base font-bold text-slate-800">No trip join requests submitted yet.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                When you request to join a driver's trip, it will appear here for you to track and manage.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <Link href="/corridor-matches">
                  <Button size="sm" variant="primary">
                    Find by Route
                  </Button>
                </Link>
                <Link href="/fuel-shares">
                  <Button size="sm" variant="outline">
                    Browse All Trips
                  </Button>
                </Link>
              </div>
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
                          <div className="text-xs text-slate-600 space-y-1 mt-1">
                            {req.pickup_name && req.drop_name && (
                              <div className="bg-indigo-50/80 border border-indigo-100 rounded-lg px-2.5 py-1 text-indigo-900 inline-block font-medium">
                                📍 Your Segment: <strong>{req.pickup_name} → {req.drop_name}</strong>
                              </div>
                            )}
                            <div>
                              📅 <span className="font-semibold">{trip.departure_date}</span> at{' '}
                              <span className="font-semibold">{trip.departure_time}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap pt-0.5">
                              {req.fare_amount ? (
                                <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  Your Proportional Share: ₹{req.fare_amount.toFixed(2)}
                                </span>
                              ) : (
                                <span>Total Trip Fuel: ₹{trip.estimated_fuel_cost}</span>
                              )}
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-600 font-medium">💺 {trip.available_seats} seats remaining</span>
                            </div>
                          </div>
                        )}

                        <div className="text-[11px] text-slate-400 pt-1">
                          Requested on {new Date(req.requested_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-end flex-wrap">
                        {req.status === 'ACCEPTED' && (req.is_paid || req.payment_status === 'SUCCESS') && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-sm">
                            <span>✅ Paid</span>
                            {req.fare_amount ? <span>(₹{req.fare_amount.toFixed(2)})</span> : null}
                          </div>
                        )}

                        {req.status === 'ACCEPTED' && !(req.is_paid || req.payment_status === 'SUCCESS') && (
                          <Link href={`/fuel-shares/${req.fuel_share_id}`}>
                            <Button variant="primary" size="sm">
                              💳 Pay {req.fare_amount ? `₹${req.fare_amount.toFixed(2)}` : 'Contribution'}
                            </Button>
                          </Link>
                        )}

                        {req.status === 'PENDING' && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setCancelJoinId(req.id)}
                          >
                            Cancel Request
                          </Button>
                        )}

                        <Link href={`/fuel-shares/${req.fuel_share_id}`}>
                          <Button variant="outline" size="sm">
                            View Trip
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        ) : (
          /* Route Corridor Requests List */
          rideRequests.length === 0 ? (
            <Card className="text-center py-12 space-y-3">
              <div className="text-4xl">🛣️</div>
              <p className="text-base font-bold text-slate-800">No route corridor requests found.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Search for rides along your specific pickup and drop-off points to find drivers passing by.
              </p>
              <div className="pt-2">
                <Link href="/corridor-matches">
                  <Button size="sm" variant="primary">
                    Find by Route Corridor
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {rideRequests.map((req) => (
                <Card key={req.id} className="hover:border-indigo-200 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-lg">
                          📍 {req.pickup_name} → 🎯 {req.drop_name}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                          req.status === 'OPEN'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : req.status === 'MATCHED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-0.5">
                        <div>
                          💺 Seats requested: <span className="font-bold text-slate-800">{req.seats_needed}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Created on {new Date(req.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-end flex-wrap">
                      <Link href="/corridor-matches">
                        <Button variant="primary" size="sm">
                          🔍 Find Matching Rides
                        </Button>
                      </Link>

                      {req.status === 'OPEN' && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setCancelRideId(req.id)}
                        >
                          Cancel Request
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}

        {/* Confirmation Dialog for Join Request Cancel */}
        <ConfirmDialog
          isOpen={cancelJoinId !== null}
          title="Cancel Join Request"
          message="Are you sure you want to cancel your pending join request for this trip?"
          confirmText="Yes, Cancel Request"
          cancelText="Keep Request"
          isLoading={cancelJoinLoading}
          onConfirm={handleConfirmCancelJoin}
          onCancel={() => setCancelJoinId(null)}
        />

        {/* Confirmation Dialog for Ride Corridor Request Cancel */}
        <ConfirmDialog
          isOpen={cancelRideId !== null}
          title="Cancel Route Request"
          message="Are you sure you want to cancel this route search request?"
          confirmText="Yes, Cancel"
          cancelText="Keep Request"
          isLoading={cancelRideLoading}
          onConfirm={handleConfirmCancelRide}
          onCancel={() => setCancelRideId(null)}
        />
      </div>
    </ProtectedRoute>
  );
}
