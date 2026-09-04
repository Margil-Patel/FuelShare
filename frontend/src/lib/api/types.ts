export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

export interface Vehicle {
  id: number;
  user_id: number;
  vehicle_type: string;
  fuel_type: string;
  mileage: number;
  seating_capacity: number;
  created_at: string;
}

export interface VehicleCreate {
  vehicle_type: string;
  fuel_type: string;
  mileage: number;
  seating_capacity: number;
}

export interface FuelShare {
  id: number;
  creator_id: number;
  source_name: string;
  source_latitude: number;
  source_longitude: number;
  destination_name: string;
  destination_latitude: number;
  destination_longitude: number;
  departure_date: string;
  departure_time: string;
  available_seats: number;
  estimated_distance: number;
  estimated_fuel_cost: number;
  route_polyline?: string | null;
  status: 'ACTIVE' | 'FULL' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
}

export interface FuelShareCreate {
  source_name: string;
  source_latitude: number;
  source_longitude: number;
  destination_name: string;
  destination_latitude: number;
  destination_longitude: number;
  departure_date: string;
  departure_time: string;
  available_seats: number;
  estimated_fuel_cost?: number;
  estimated_distance?: number;
}

export interface FuelShareUpdate {
  source_name?: string;
  source_latitude?: number;
  source_longitude?: number;
  destination_name?: string;
  destination_latitude?: number;
  destination_longitude?: number;
  departure_date?: string;
  departure_time?: string;
  available_seats?: number;
  estimated_fuel_cost?: number;
  status?: 'ACTIVE' | 'FULL' | 'COMPLETED' | 'CANCELLED';
}

export interface JoinRequest {
  id: number;
  fuel_share_id: number;
  user_id: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  requested_at: string;
  accepted_at?: string | null;
  fare_amount?: number | null;
  pickup_name?: string | null;
  drop_name?: string | null;
  payment_status?: string | null;
  is_paid?: boolean;
  user?: {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
  } | null;
  fuel_share?: FuelShare | null;
}

export interface FuelCost {
  fuel_share_id: number;
  distance_km: number;
  fuel_price_per_litre: number;
  vehicle_mileage_km_per_litre: number;
  fuel_required_litres: number;
  total_fuel_cost: number;
  participant_count: number;
  cost_per_participant: number;
  estimated_savings_per_participant: number;
  estimated_fuel_saved_litres: number;
}

export interface MatchItem {
  fuel_share_id: number;
  creator_id: number;
  match_score: number;
  reasons: string[];
  pickup_distance_km: number;
  destination_distance_km: number;
  time_difference_minutes: number;
  source_name: string;
  destination_name: string;
  departure_date: string;
  departure_time: string;
  available_seats: number;
  estimated_fuel_cost: number;
}

export interface MatchListResponse {
  requested_fuel_share_id: number;
  total_matches: number;
  match_threshold: number;
  matches: MatchItem[];
}

export interface CreateOrderResponse {
  order_id: string;
  amount_paise: number;
  amount_rupees: number;
  currency: string;
  key_id: string;
  payment_id: number;
}

export interface PaymentVerifyRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface Payment {
  id: number;
  user_id: number;
  fuel_share_id: number;
  amount: number;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  created_at: string;
  updated_at: string;
}

export interface ImpactMetrics {
  total_money_saved_rupees: number;
  total_fuel_saved_litres: number;
  total_co2_reduced_kg: number;
  completed_shared_trips: number;
  total_participants: number;
}

export interface ActivityFeedItem {
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

export interface DashboardResponse {
  user_name: string;
  metrics: ImpactMetrics;
  recent_activity: ActivityFeedItem[];
}

export interface LocationSearchResult {
  name: string;
  latitude: number;
  longitude: number;
  display_name: string;
}

export interface ReverseGeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
}

// ─── Corridor Matching Types ────────────────────────────────────────────────

export type RideRequestStatus = 'OPEN' | 'MATCHED' | 'EXPIRED' | 'CANCELLED';

export interface RideRequest {
  id: number;
  passenger_id: number;
  pickup_name: string;
  pickup_latitude: number;
  pickup_longitude: number;
  drop_name: string;
  drop_latitude: number;
  drop_longitude: number;
  desired_departure?: string | null;
  seats_needed: number;
  status: RideRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface RideRequestCreate {
  pickup_name: string;
  pickup_latitude: number;
  pickup_longitude: number;
  drop_name: string;
  drop_latitude: number;
  drop_longitude: number;
  desired_departure?: string | null;
  seats_needed?: number;
}

export type CorridorMatchStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface CorridorMatchResult {
  fuel_share_id: number;
  ride_request_id: number;
  driver_id: number;
  source_name: string;
  destination_name: string;
  departure_datetime: string;
  available_seats: number;
  total_route_km: number;
  route_polyline: string | null;
  pickup_buffer_m: number;
  drop_buffer_m: number;
  pickup_fraction: number;
  drop_fraction: number;
  detour_distance_m: number;
  fare_estimate: number;
  fare_strategy: string;
  passenger_id: number | null;
  pickup_name: string;
  drop_name: string;
  seats_needed: number;
  pickup_latitude: number;
  pickup_longitude: number;
  drop_latitude: number;
  drop_longitude: number;
  desired_departure: string | null;
  match_id: number | null;
  match_status: CorridorMatchStatus;
}

export interface CorridorMatchListResponse {
  total_matches: number;
  buffer_m: number;
  detour_max_km: number;
  time_window_minutes?: number | null;
  matches: CorridorMatchResult[];
}

export interface CorridorMatchRecord {
  id: number;
  fuel_share_id: number;
  ride_request_id: number;
  detour_distance_m: number;
  pickup_buffer_m: number;
  drop_buffer_m: number;
  pickup_fraction: number;
  drop_fraction: number;
  fare_estimate: number;
  fare_strategy: string;
  status: CorridorMatchStatus;
  created_at: string;
  updated_at: string;
  payment_hook: {
    fare_estimate_rupees: number;
    fuel_share_id: number;
    ride_request_id: number;
    corridor_match_id: number;
    action: string;
    note: string;
  } | null;
}
