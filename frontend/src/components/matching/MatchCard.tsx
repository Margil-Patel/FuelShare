import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MatchItem } from '@/lib/api/types';

interface MatchCardProps {
  match: MatchItem;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match }) => {
  const score = match.match_score;

  let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let progressBg = 'bg-emerald-500';

  if (score < 80 && score >= 65) {
    badgeStyle = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    progressBg = 'bg-indigo-600';
  } else if (score < 65) {
    badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
    progressBg = 'bg-amber-500';
  }

  return (
    <Card className="hover:border-indigo-300 transition-all flex flex-col justify-between space-y-4">
      <div className="space-y-4">
        {/* Score & Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
              {match.source_name} → {match.destination_name}
            </h3>
            <span className="text-xs text-slate-400 font-mono">Trip ID #{match.fuel_share_id}</span>
          </div>

          <div className="flex flex-col items-end">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border ${badgeStyle}`}>
              ⚡ {score}% Match
            </span>
            <div className="w-20 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
              <div className={`h-full ${progressBg}`} style={{ width: `${score}%` }}></div>
            </div>
          </div>
        </div>

        {/* Schedule & Proximity Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl">
          <div>
            <span className="text-slate-400 font-semibold block uppercase">Departure</span>
            <span className="font-bold text-slate-800">
              {match.departure_date} at {match.departure_time}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-semibold block uppercase">Available Seats</span>
            <span className="font-bold text-emerald-600">{match.available_seats} seats</span>
          </div>

          <div>
            <span className="text-slate-400 font-semibold block uppercase">Pickup Distance</span>
            <span className="font-bold text-indigo-600">{match.pickup_distance_km} km away</span>
          </div>

          <div>
            <span className="text-slate-400 font-semibold block uppercase">Dropoff Distance</span>
            <span className="font-bold text-slate-800">{match.destination_distance_km} km away</span>
          </div>
        </div>

        {/* Match Reasons List */}
        {match.reasons && match.reasons.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Match Highlights:
            </span>
            <ul className="space-y-1 text-xs">
              {match.reasons.map((reason, idx) => (
                <li key={idx} className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <span className="text-emerald-500 font-extrabold">✓</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400 italic">Estimated compatibility score</span>
        <Link href={`/fuel-shares/${match.fuel_share_id}`}>
          <Button variant="primary" size="sm">
            View Trip Details
          </Button>
        </Link>
      </div>
    </Card>
  );
};
