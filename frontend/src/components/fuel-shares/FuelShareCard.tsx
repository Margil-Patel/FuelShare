import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FuelShareStatusBadge } from './FuelShareStatus';
import { FuelShare } from '@/lib/api/types';

interface FuelShareCardProps {
  trip: FuelShare;
  currentUserId?: number;
  onCancel?: (tripId: number) => void;
  onEdit?: (trip: FuelShare) => void;
}

export const FuelShareCard: React.FC<FuelShareCardProps> = ({
  trip,
  currentUserId,
  onCancel,
  onEdit,
}) => {
  const isCreator = currentUserId === trip.creator_id;

  return (
    <Card className="hover:border-indigo-200 transition-all flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg leading-snug">
              {trip.source_name} → {trip.destination_name}
            </h3>
            <span className="text-xs text-slate-400 font-mono">Trip ID #{trip.id}</span>
          </div>
          <FuelShareStatusBadge status={trip.status} />
        </div>

        <div className="grid grid-cols-2 gap-2 py-2 text-xs bg-slate-50 p-3 rounded-xl">
          <div>
            <span className="text-slate-400 font-semibold block uppercase">Departure</span>
            <span className="font-bold text-slate-800">
              {trip.departure_date} at {trip.departure_time}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold block uppercase">Est. Distance</span>
            <span className="font-bold text-slate-800">{trip.estimated_distance} km</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold block uppercase">Available Seats</span>
            <span className="font-bold text-emerald-600">{trip.available_seats} remaining</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold block uppercase">Est. Fuel Cost</span>
            <span className="font-bold text-slate-800">₹{trip.estimated_fuel_cost}</span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500 font-medium">
          {isCreator ? '👤 Posted by You' : '👤 Commuter Driver'}
        </span>

        <div className="flex gap-2">
          {isCreator && trip.status === 'ACTIVE' && (
            <Link href={`/fuel-shares/${trip.id}/matches`}>
              <Button variant="secondary" size="sm">
                ⚡ Matches
              </Button>
            </Link>
          )}

          {isCreator && trip.status === 'ACTIVE' && onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(trip)}>
              Edit
            </Button>
          )}

          {isCreator && trip.status === 'ACTIVE' && onCancel && (
            <Button variant="danger" size="sm" onClick={() => onCancel(trip.id)}>
              Cancel
            </Button>
          )}

          <Link href={`/fuel-shares/${trip.id}`}>
            <Button variant="outline" size="sm">
              Details
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
};
