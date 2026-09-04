'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { getFuelSharesApi } from '@/lib/api/fuelShare';
import { FuelShare } from '@/lib/api/types';
import { useAuth } from '@/context/AuthContext';

export default function FuelSharesPage() {
  const { user } = useAuth();
  const [fuelShares, setFuelShares] = useState<FuelShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sourceFilter, setSourceFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');

  const fetchTrips = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFuelSharesApi({
        source: sourceFilter || undefined,
        destination: destinationFilter || undefined,
      });
      setFuelShares(data);
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to search fuel shares.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTrips();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Available Fuel Shares</h1>
          <p className="text-sm text-slate-500 mt-1">
            Find commuters heading your direction and split fuel costs.
          </p>
        </div>
        {user && (
          <Link href="/fuel-shares/create">
            <Button variant="primary">+ Offer Fuel Share</Button>
          </Link>
        )}
      </div>

      {/* Filter Card */}
      <Card>
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <Input
            label="Starting Point"
            placeholder="e.g. Bopal, Koramangala"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          />

          <Input
            label="Ending Point"
            placeholder="e.g. SG Highway, Airport"
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
          />

          <Button type="submit" variant="secondary" className="w-full">
            Search Trips
          </Button>
        </form>
      </Card>

      {error && <ErrorAlert message={error} onRetry={fetchTrips} />}

      {loading ? (
        <LoadingSpinner message="Searching available fuel shares..." />
      ) : fuelShares.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-base font-bold text-slate-700">No fuel shares found matching your query.</p>
          <p className="text-xs text-slate-500 mt-1">Try resetting your filters or post a new fuel share offer!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fuelShares.map((trip) => (
            <Card key={trip.id} className="hover:border-indigo-200 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-lg">
                      {trip.source_name} → {trip.destination_name}
                    </h3>
                    <p className="text-xs text-slate-500">Trip ID #{trip.id}</p>
                  </div>
                  <Badge variant={trip.status.toLowerCase() as any}>{trip.status}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 py-2 text-xs bg-slate-50 p-3 rounded-xl">
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase">Departure</span>
                    <span className="font-bold text-slate-800">{trip.departure_date} at {trip.departure_time}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase">Distance</span>
                    <span className="font-bold text-slate-800">{trip.estimated_distance} km</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase">Available Seats</span>
                    <span className="font-bold text-emerald-600">{trip.available_seats} seats</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase">Total Trip Cost</span>
                    <span className="font-bold text-slate-800">₹{trip.estimated_fuel_cost}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  {trip.creator_id === user?.id ? '👤 Posted by You' : '👤 Driver User'}
                </span>
                <Link href={`/fuel-shares/${trip.id}`}>
                  <Button variant="outline" size="sm">
                    View Details & Cost
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
