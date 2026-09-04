'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { createVehicleApi, deleteVehicleApi, getVehiclesApi } from '@/lib/api/vehicle';
import { Vehicle } from '@/lib/api/types';
import { useAuth } from '@/context/AuthContext';

export default function VehiclesPage() {
  const { user } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [vehicleType, setVehicleType] = useState('Sedan Car');
  const [fuelType, setFuelType] = useState('Petrol');
  const [mileage, setMileage] = useState(15.0);
  const [seatingCapacity, setSeatingCapacity] = useState(4);

  const fetchVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVehiclesApi();
      setVehicles(data);
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load vehicles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchVehicles();
    }
  }, [user]);

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mileage <= 0) {
      setError('Vehicle mileage must be greater than zero.');
      return;
    }

    setFormLoading(true);
    try {
      await createVehicleApi({
        vehicle_type: vehicleType,
        fuel_type: fuelType,
        mileage: Number(mileage),
        seating_capacity: Number(seatingCapacity),
      });
      fetchVehicles();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to add vehicle.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: number) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      await deleteVehicleApi(vehicleId);
      fetchVehicles();
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to delete vehicle.');
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Vehicle Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Register your vehicles with accurate mileage to calculate trip fuel cost sharing.
          </p>
        </div>

        {error && <ErrorAlert message={error} />}

        {/* Form Card */}
        <Card title="Add a New Vehicle" subtitle="Used to compute fuel requirements for your created Fuel Shares">
          <form onSubmit={handleCreateVehicle} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Vehicle Type / Model"
                placeholder="e.g. Honda City Sedan"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                required
              />

              <Input
                label="Fuel Type"
                placeholder="e.g. Petrol, Diesel, CNG, EV"
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                required
              />

              <Input
                label="Mileage (km / Litre)"
                type="number"
                step="0.1"
                min="0.1"
                value={mileage}
                onChange={(e) => setMileage(Number(e.target.value))}
                helperText="Fuel efficiency in km per litre"
                required
              />

              <Input
                label="Seating Capacity"
                type="number"
                min="1"
                max="15"
                value={seatingCapacity}
                onChange={(e) => setSeatingCapacity(Number(e.target.value))}
                required
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" isLoading={formLoading}>
                + Save Vehicle
              </Button>
            </div>
          </form>
        </Card>

        {/* Vehicles List Card */}
        <Card title="Registered Vehicles">
          {loading ? (
            <LoadingSpinner message="Loading your vehicles..." />
          ) : vehicles.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              You don&apos;t have any registered vehicles yet. Use the form above to add one!
            </p>
          ) : (
            <div className="space-y-3">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">{v.vehicle_type}</span>
                      <Badge variant="active">{v.fuel_type}</Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Mileage: <span className="font-extrabold text-emerald-600">{v.mileage} km/L</span> • Capacity:{' '}
                      <span className="font-semibold text-slate-700">{v.seating_capacity} seats</span>
                    </div>
                  </div>

                  <Button variant="danger" size="sm" onClick={() => handleDeleteVehicle(v.id)}>
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </ProtectedRoute>
  );
}
