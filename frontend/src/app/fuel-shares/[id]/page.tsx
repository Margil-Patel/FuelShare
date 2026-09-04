'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FuelShareStatusBadge } from '@/components/fuel-shares/FuelShareStatus';
import { getFuelShareByIdApi, updateFuelShareApi, deleteFuelShareApi } from '@/lib/api/fuelShare';
import { getFuelShareCostApi } from '@/lib/api/cost';
import {
  joinFuelShareApi,
  getIncomingRequestsApi,
  getMyJoinRequestsApi,
  acceptJoinRequestApi,
  rejectJoinRequestApi,
  cancelJoinRequestApi,
} from '@/lib/api/joinRequest';
import { FuelCost, FuelShare, JoinRequest } from '@/lib/api/types';
import { useAuth } from '@/context/AuthContext';
import { PaymentCard } from '@/components/payment/PaymentCard';
import { RouteMapPicker } from '@/components/ui/RouteMapPicker';

export default function FuelShareDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);
  const { user } = useAuth();

  const [trip, setTrip] = useState<FuelShare | null>(null);
  const [cost, setCost] = useState<FuelCost | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<JoinRequest[]>([]);
  const [myRequest, setMyRequest] = useState<JoinRequest | null>(null);

  const [loading, setLoading] = useState(true);
  const [requestLoading, setRequestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Cancellation & Editing state for trip
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    source_name: '',
    destination_name: '',
    departure_date: '',
    departure_time: '',
    available_seats: 1,
    estimated_fuel_cost: 0,
  });
  const [editLoading, setEditLoading] = useState(false);

  // Confirmation dialog states for requests
  const [isJoinConfirmOpen, setIsJoinConfirmOpen] = useState(false);
  const [isCancelReqConfirmOpen, setIsCancelReqConfirmOpen] = useState(false);

  const loadTripData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const tripData = await getFuelShareByIdApi(id);
      setTrip(tripData);

      setEditForm({
        source_name: tripData.source_name,
        destination_name: tripData.destination_name,
        departure_date: tripData.departure_date,
        departure_time: tripData.departure_time,
        available_seats: tripData.available_seats,
        estimated_fuel_cost: tripData.estimated_fuel_cost,
      });

      if (user) {
        // Load cost if authorized
        try {
          const costData = await getFuelShareCostApi(id);
          setCost(costData);
        } catch {
          setCost(null);
        }

        // Creator loads incoming requests
        if (tripData.creator_id === user.id) {
          try {
            const reqs = await getIncomingRequestsApi(id);
            setIncomingRequests(reqs);
          } catch {
            setIncomingRequests([]);
          }
        } else {
          // Requester loads their submitted requests for this trip
          try {
            const myRequests = await getMyJoinRequestsApi();
            const found = myRequests.find((r) => r.fuel_share_id === id);
            setMyRequest(found || null);
          } catch {
            setMyRequest(null);
          }
        }
      }
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load trip details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTripData();
  }, [id, user]);

  const handleConfirmCancelTrip = async () => {
    if (!trip) return;
    setCancelLoading(true);
    try {
      await deleteFuelShareApi(trip.id);
      setActionSuccess('Trip cancelled successfully.');
      setIsCancelConfirmOpen(false);
      loadTripData();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to cancel trip.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;
    setEditLoading(true);
    setError(null);
    try {
      await updateFuelShareApi(trip.id, {
        source_name: editForm.source_name,
        destination_name: editForm.destination_name,
        departure_date: editForm.departure_date,
        departure_time: editForm.departure_time.length === 5 ? `${editForm.departure_time}:00` : editForm.departure_time,
        available_seats: Number(editForm.available_seats),
        estimated_fuel_cost: Number(editForm.estimated_fuel_cost),
      });
      setActionSuccess('Trip details updated successfully!');
      setIsEditing(false);
      loadTripData();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to update trip.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleConfirmJoinRequest = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    setRequestLoading(true);
    setError(null);
    setActionSuccess(null);
    try {
      await joinFuelShareApi(id);
      setActionSuccess('Join Request submitted successfully! Awaiting creator approval.');
      setIsJoinConfirmOpen(false);
      loadTripData();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to submit join request.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleConfirmCancelRequest = async () => {
    if (!myRequest) return;
    setRequestLoading(true);
    setError(null);
    try {
      await cancelJoinRequestApi(myRequest.id);
      setActionSuccess('Your join request was cancelled.');
      setIsCancelReqConfirmOpen(false);
      loadTripData();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to cancel join request.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleAcceptRequest = async (reqId: number) => {
    setRequestLoading(true);
    setError(null);
    try {
      await acceptJoinRequestApi(reqId);
      setActionSuccess('Accepted join request and reserved seat!');
      loadTripData();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to accept request.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleRejectRequest = async (reqId: number) => {
    setRequestLoading(true);
    setError(null);
    try {
      await rejectJoinRequestApi(reqId);
      setActionSuccess('Rejected join request.');
      loadTripData();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to reject request.');
    } finally {
      setRequestLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading trip details..." />;
  }

  if (error && !trip) {
    return (
      <div className="max-w-md mx-auto py-12">
        <ErrorAlert message={error} onRetry={loadTripData} />
      </div>
    );
  }

  if (!trip) return null;

  const isCreator = user?.id === trip.creator_id;
  const canRequestToJoin =
    !isCreator &&
    trip.status === 'ACTIVE' &&
    trip.available_seats > 0 &&
    (!myRequest || myRequest.status === 'CANCELLED' || myRequest.status === 'REJECTED');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/fuel-shares')}>
          ← Back to All Trips
        </Button>
        <FuelShareStatusBadge status={trip.status} />
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold rounded-xl">
          ✅ {actionSuccess}
        </div>
      )}

      {error && <ErrorAlert message={error} />}

      {/* Main Trip Card */}
      <Card title={`${trip.source_name} → ${trip.destination_name}`} subtitle={`Fuel Share Offer #${trip.id}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-4">
          <div className="p-4 bg-slate-50 rounded-xl space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase">Departure</span>
            <p className="text-base font-extrabold text-slate-900">{trip.departure_date}</p>
            <p className="text-xs text-slate-600">Time: {trip.departure_time}</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase">Route Distance</span>
            <p className="text-base font-extrabold text-slate-900">{trip.estimated_distance} km</p>
            <p className="text-xs text-slate-600">Geo-calculated Haversine</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase">Available Seats</span>
            <p className="text-base font-extrabold text-emerald-600">{trip.available_seats} remaining</p>
            <p className="text-xs text-slate-600">Est. Fuel Cost: ₹{trip.estimated_fuel_cost}</p>
          </div>
        </div>

        {/* Interactive Route Map */}
        <div className="my-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Trip Route Map
          </label>
          <RouteMapPicker
            origin={{ name: trip.source_name, latitude: trip.source_latitude, longitude: trip.source_longitude }}
            destination={{ name: trip.destination_name, latitude: trip.destination_latitude, longitude: trip.destination_longitude }}
            routePolyline={trip.route_polyline}
            readOnly
          />
        </div>

        {/* Creator Management Action Bar */}
        {isCreator && trip.status === 'ACTIVE' && (
          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
            <Link href={`/fuel-shares/${trip.id}/matches`}>
              <Button variant="secondary" size="sm">
                ⚡ Find Matches
              </Button>
            </Link>

            <Link href={`/fuel-shares/${trip.id}/corridor`}>
              <Button variant="outline" size="sm">
                🛣️ Corridor Passengers
              </Button>
            </Link>

            <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? 'Close Edit Form' : '✏️ Edit Trip'}
            </Button>

            <Button variant="danger" size="sm" onClick={() => setIsCancelConfirmOpen(true)}>
              🚫 Cancel Trip
            </Button>
          </div>
        )}

        {/* Requester Action Bar */}
        {!isCreator && user && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            {myRequest && (
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                  myRequest.status === 'ACCEPTED'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold'
                    : myRequest.status === 'PENDING'
                    ? 'bg-amber-50 border-amber-200 text-amber-900 font-semibold'
                    : myRequest.status === 'REJECTED'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div>
                  <span className="uppercase text-[10px] tracking-wider block font-bold">Your Join Request</span>
                  <span className="text-sm font-extrabold flex items-center gap-2 flex-wrap">
                    {myRequest.status === 'ACCEPTED' && '✅ Accepted! Seat Reserved.'}
                    {myRequest.status === 'PENDING' && '⏳ Join Request Pending Approval'}
                    {myRequest.status === 'REJECTED' && '❌ Request Rejected by Creator'}
                    {myRequest.status === 'CANCELLED' && 'Request Cancelled'}
                    {(myRequest.is_paid || myRequest.payment_status === 'SUCCESS') && (
                      <span className="bg-emerald-600 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">
                        Paid
                      </span>
                    )}
                  </span>
                  {myRequest.pickup_name && myRequest.drop_name && (
                    <div className="text-xs font-medium text-slate-600 mt-1">
                      📍 Your Segment: <span className="font-semibold text-slate-900">{myRequest.pickup_name} → {myRequest.drop_name}</span>
                    </div>
                  )}
                  {myRequest.fare_amount !== null && myRequest.fare_amount !== undefined && (
                    <div className="text-xs font-bold text-emerald-700 mt-0.5">
                      Your Proportional Share: ₹{myRequest.fare_amount.toFixed(2)}
                    </div>
                  )}
                </div>

                {myRequest.status === 'PENDING' && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setIsCancelReqConfirmOpen(true)}
                  >
                    Cancel Request
                  </Button>
                )}
              </div>
            )}

            {myRequest && myRequest.status === 'ACCEPTED' && (
              <div className="pt-2">
                <PaymentCard
                  fuelShareId={trip.id}
                  contributionAmount={
                    myRequest.fare_amount !== null && myRequest.fare_amount !== undefined
                      ? myRequest.fare_amount
                      : cost?.cost_per_participant || trip.estimated_fuel_cost
                  }
                  onPaymentSuccess={() => loadTripData()}
                />
              </div>
            )}

            {canRequestToJoin && (
              <div className="flex justify-end">
                <Button onClick={() => setIsJoinConfirmOpen(true)} isLoading={requestLoading}>
                  Request to Join Trip
                </Button>
              </div>
            )}
          </div>
        )}

        {!user && (
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button onClick={() => router.push('/login')}>Log In to Request to Join</Button>
          </div>
        )}
      </Card>

      {/* Confirmation Dialog for Submitting Join Request */}
      <ConfirmDialog
        isOpen={isJoinConfirmOpen}
        title="Confirm Request to Join"
        message={`Send a request to join this trip (${trip.source_name} → ${trip.destination_name})? The creator will review and accept your seat reservation.`}
        confirmText="Send Request"
        cancelText="Cancel"
        isLoading={requestLoading}
        onConfirm={handleConfirmJoinRequest}
        onCancel={() => setIsJoinConfirmOpen(false)}
      />

      {/* Confirmation Dialog for Cancelling Join Request */}
      <ConfirmDialog
        isOpen={isCancelReqConfirmOpen}
        title="Cancel Pending Join Request"
        message="Are you sure you want to cancel your pending join request for this trip?"
        confirmText="Yes, Cancel Request"
        cancelText="Keep Request"
        isLoading={requestLoading}
        onConfirm={handleConfirmCancelRequest}
        onCancel={() => setIsCancelReqConfirmOpen(false)}
      />

      {/* Confirmation Dialog for Trip Cancellation */}
      <ConfirmDialog
        isOpen={isCancelConfirmOpen}
        title="Cancel Fuel Share Offer"
        message="Are you sure you want to cancel this trip? Cancelling will set the status to CANCELLED."
        confirmText="Yes, Cancel Trip"
        cancelText="Keep Active"
        isLoading={cancelLoading}
        onConfirm={handleConfirmCancelTrip}
        onCancel={() => setIsCancelConfirmOpen(false)}
      />

      {/* Inline Edit Form for Creator */}
      {isCreator && isEditing && (
        <Card title="Edit Trip Details">
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <Input
                label="Available Seats"
                type="number"
                min={1}
                value={editForm.available_seats}
                onChange={(e) => setEditForm({ ...editForm, available_seats: Number(e.target.value) })}
                required
              />
            </div>

            <Input
              label="Estimated Fuel Cost (₹)"
              type="number"
              min={1}
              value={editForm.estimated_fuel_cost}
              onChange={(e) => setEditForm({ ...editForm, estimated_fuel_cost: Number(e.target.value) })}
              required
            />

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={editLoading}>
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Fuel Cost Breakdown */}
      {cost && (
        <Card title="Fuel Cost & Savings Calculation" subtitle="Phase 9 Equal Cost Sharing Breakdown">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-semibold uppercase block">Fuel Price</span>
              <span className="text-base font-bold text-slate-900">₹{cost.fuel_price_per_litre}/L</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-semibold uppercase block">Vehicle Mileage</span>
              <span className="text-base font-bold text-slate-900">{cost.vehicle_mileage_km_per_litre} km/L</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-semibold uppercase block">Fuel Required</span>
              <span className="text-base font-bold text-indigo-600">{cost.fuel_required_litres} Litres</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-semibold uppercase block">Total Trip Cost</span>
              <span className="text-base font-bold text-slate-900">₹{cost.total_fuel_cost}</span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-indigo-50 border border-emerald-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Participants Count</span>
              <p className="text-xl font-black text-slate-900 mt-0.5">{cost.participant_count} People</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">
                {myRequest?.fare_amount !== null && myRequest?.fare_amount !== undefined ? 'Your Segment Share' : 'Cost Per Person'}
              </span>
              <p className="text-xl font-black text-emerald-600 mt-0.5">
                ₹{myRequest?.fare_amount !== null && myRequest?.fare_amount !== undefined ? myRequest.fare_amount.toFixed(2) : cost.cost_per_participant}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Estimated Savings / Person</span>
              <p className="text-xl font-black text-indigo-600 mt-0.5">₹{cost.estimated_savings_per_participant}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Creator View: Incoming Join Requests */}
      {isCreator && (
        <Card title="Incoming Join Requests" subtitle="Review requests from commuters to accept & reserve seats">
          {incomingRequests.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No incoming join requests received yet.</p>
          ) : (
            <div className="space-y-3">
              {incomingRequests.map((req) => (
                <div key={req.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">
                      {req.user?.name || `User #${req.user_id}`}
                    </span>
                    {req.user?.email && (
                      <div className="text-xs text-slate-500">{req.user.email} {req.user.phone ? `• ${req.user.phone}` : ''}</div>
                    )}
                    <div className="text-[11px] text-slate-400">Requested: {new Date(req.requested_at).toLocaleString()}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <FuelShareStatusBadge status={req.status} />

                    {req.status === 'PENDING' && (
                      <div className="flex gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAcceptRequest(req.id)}
                          isLoading={requestLoading}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleRejectRequest(req.id)}
                          isLoading={requestLoading}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
