'use client';

import React, { useEffect, useRef, useState } from 'react';
import { reverseGeocodeApi, fetchDrivingRouteApi } from '@/lib/api/location';

interface RouteMapPickerProps {
  origin?: { name: string; latitude: number; longitude: number } | null;
  destination?: { name: string; latitude: number; longitude: number } | null;
  routePolyline?: string | null;
  onSelectOrigin?: (loc: { name: string; latitude: number; longitude: number }) => void;
  onSelectDestination?: (loc: { name: string; latitude: number; longitude: number }) => void;
  activeMode?: 'origin' | 'destination';
  setActiveMode?: (mode: 'origin' | 'destination') => void;
  readOnly?: boolean;
  className?: string;
}

/**
 * Pure JavaScript Google/OSRM precision-5 polyline decoder.
 * Converts encoded polyline string to array of [latitude, longitude] tuples.
 */
function decodePolyline(encoded: string): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const length = encoded.length;

  while (index < length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

function patchLeafletDomUtil(L: any) {
  if (!L || (L as any)._offsetWidthPatched) return;
  (L as any)._offsetWidthPatched = true;

  if (L.DomUtil) {
    L.DomUtil.getSizedParentNode = function (element: any) {
      if (!element) return (typeof document !== 'undefined' ? document.body : null);
      let curr = element.parentNode || element;
      while (curr && typeof document !== 'undefined' && curr !== document.body && curr !== document) {
        if (curr.offsetWidth && curr.offsetHeight) {
          return curr;
        }
        curr = curr.parentNode;
      }
      return typeof document !== 'undefined' ? (document.body || element) : element;
    };

    L.DomUtil.getScale = function (element: any) {
      if (!element || !element.getBoundingClientRect) {
        return { x: 1, y: 1, boundingClientRect: { width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0 } };
      }
      try {
        const rect = element.getBoundingClientRect();
        return {
          x: element.offsetWidth ? (rect.width / element.offsetWidth || 1) : 1,
          y: element.offsetHeight ? (rect.height / element.offsetHeight || 1) : 1,
          boundingClientRect: rect,
        };
      } catch {
        return { x: 1, y: 1, boundingClientRect: { width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0 } };
      }
    };
  }

  if (L.Draggable && L.Draggable.prototype) {
    const origOnDown = L.Draggable.prototype._onDown;
    L.Draggable.prototype._onDown = function (e: any) {
      if (!this._element) return;
      try {
        origOnDown.call(this, e);
      } catch {
        // Suppress drag error if element is detached/unmeasured
      }
    };
  }
}

export const RouteMapPicker: React.FC<RouteMapPickerProps> = ({
  origin,
  destination,
  routePolyline,
  onSelectOrigin,
  onSelectDestination,
  activeMode = 'origin',
  setActiveMode,
  readOnly = false,
  className = '',
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    // Dynamically import Leaflet client-side only
    let isMounted = true;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      patchLeafletDomUtil(L);
      if (!isMounted || !mapRef.current) return;

      // Add Leaflet CSS dynamically if not present
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Default center: Gujarat / India (23.0225, 72.5714 - Ahmedabad)
      const initialLat = origin?.latitude || 23.0225;
      const initialLng = origin?.longitude || 72.5714;

      if (!leafletMapRef.current && mapRef.current) {
        try {
          const map = L.map(mapRef.current).setView([initialLat, initialLng], 11);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          }).addTo(map);

          leafletMapRef.current = map;

          // Map Click listener
          if (!readOnly) {
            map.on('click', async (e: any) => {
              const { lat, lng } = e.latlng;
              try {
                const res = await reverseGeocodeApi(lat, lng);
                const loc = { name: res.name, latitude: lat, longitude: lng };
                if (activeMode === 'origin' && onSelectOrigin) {
                  onSelectOrigin(loc);
                } else if (activeMode === 'destination' && onSelectDestination) {
                  onSelectDestination(loc);
                }
              } catch {
                const fallbackLoc = { name: `Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`, latitude: lat, longitude: lng };
                if (activeMode === 'origin' && onSelectOrigin) onSelectOrigin(fallbackLoc);
                if (activeMode === 'destination' && onSelectDestination) onSelectDestination(fallbackLoc);
              }
            });
          }

          setMapLoaded(true);

          setTimeout(() => {
            try {
              if (map && map.getContainer() && document.body.contains(map.getContainer())) {
                map.invalidateSize({ pan: false });
              }
            } catch {
              // ignore
            }
          }, 250);
        } catch {
          // ignore double init in React StrictMode
        }
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.remove();
        } catch {
          // ignore cleanup errors
        }
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Update Markers & Polyline when props change or map finishes loading
  useEffect(() => {
    let isCancelled = false;
    if (!leafletMapRef.current || !mapLoaded) return;

    import('leaflet').then(async (LModule) => {
      if (isCancelled || !leafletMapRef.current || !leafletMapRef.current.getContainer()) return;
      const L = LModule.default;
      const map = leafletMapRef.current;

      // Custom Pin Icons
      const originIcon = L.divIcon({
        className: 'custom-leaflet-icon',
        html: `<div style="background-color: #10b981; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);">📍</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const destIcon = L.divIcon({
        className: 'custom-leaflet-icon',
        html: `<div style="background-color: #f43f5e; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);">🎯</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      // Clear existing layers safely
      try {
        if (originMarkerRef.current && map.hasLayer(originMarkerRef.current)) {
          map.removeLayer(originMarkerRef.current);
        }
        if (destMarkerRef.current && map.hasLayer(destMarkerRef.current)) {
          map.removeLayer(destMarkerRef.current);
        }
        if (polylineRef.current && map.hasLayer(polylineRef.current)) {
          map.removeLayer(polylineRef.current);
        }
      } catch {
        // ignore unattached layer cleanup errors
      }

      const bounds = L.latLngBounds([]);

      if (origin?.latitude && origin?.longitude && !isNaN(origin.latitude) && !isNaN(origin.longitude)) {
        const originMarker = L.marker([origin.latitude, origin.longitude], { icon: originIcon })
          .addTo(map)
          .bindPopup(`<b>Pickup:</b> ${origin.name || 'Origin'}`);
        originMarkerRef.current = originMarker;
        bounds.extend([origin.latitude, origin.longitude]);
      }

      if (destination?.latitude && destination?.longitude && !isNaN(destination.latitude) && !isNaN(destination.longitude)) {
        const destMarker = L.marker([destination.latitude, destination.longitude], { icon: destIcon })
          .addTo(map)
          .bindPopup(`<b>Destination:</b> ${destination.name || 'Destination'}`);
        destMarkerRef.current = destMarker;
        bounds.extend([destination.latitude, destination.longitude]);
      }

      // Draw actual driving road route polyline
      if (
        origin?.latitude &&
        destination?.latitude &&
        !isNaN(origin.latitude) &&
        !isNaN(destination.latitude)
      ) {
        let polylineCoords: [number, number][] = [];

        // 1. If stored route polyline exists, decode and render immediately
        if (routePolyline && routePolyline.trim().length > 0) {
          polylineCoords = decodePolyline(routePolyline);
        }

        // 2. Otherwise fetch driving route from OSRM
        if (polylineCoords.length === 0) {
          try {
            const routeData = await fetchDrivingRouteApi(
              origin.latitude,
              origin.longitude,
              destination.latitude,
              destination.longitude
            );
            if (routeData && routeData.geometry && routeData.geometry.length > 0) {
              polylineCoords = routeData.geometry;
            }
          } catch {
            // fallback below
          }
        }

        // 3. Fallback: straight line between origin & destination
        if (polylineCoords.length === 0) {
          polylineCoords = [
            [origin.latitude, origin.longitude],
            [destination.latitude, destination.longitude],
          ];
        }

        if (isCancelled || !leafletMapRef.current || !leafletMapRef.current.getContainer()) return;

        const polyline = L.polyline(polylineCoords, {
          color: '#4f46e5', // Vibrant Indigo road path
          weight: 6,
          opacity: 0.95,
          lineJoin: 'round',
          lineCap: 'round',
          className: 'leaflet-route-polyline',
        }).addTo(map);

        polylineRef.current = polyline;

        polylineCoords.forEach(([lat, lng]) => bounds.extend([lat, lng]));
      }

      // Fit map bounds to view all route points and markers
      if (bounds.isValid()) {
        try {
          if (map && map.getContainer() && document.body.contains(map.getContainer())) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
            setTimeout(() => {
              try {
                if (map && map.getContainer() && document.body.contains(map.getContainer())) {
                  map.invalidateSize({ pan: false });
                }
              } catch {
                // ignore
              }
            }, 150);
          }
        } catch {
          // ignore fit bounds calculation during active layout reflow
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    mapLoaded,
    origin?.latitude,
    origin?.longitude,
    destination?.latitude,
    destination?.longitude,
    routePolyline,
  ]);

  return (
    <div className={`space-y-2 ${className}`}>
      {!readOnly && setActiveMode && (
        <div className="flex items-center justify-between bg-slate-100 p-2 rounded-xl text-xs font-semibold">
          <span className="text-slate-600">Click on map to pick:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveMode('origin')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                activeMode === 'origin'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200'
              }`}
            >
              📍 Starting Point Pin
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('destination')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                activeMode === 'destination'
                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200'
              }`}
            >
              🎯 Ending Point Pin
            </button>
          </div>
        </div>
      )}

      <div
        ref={mapRef}
        className="w-full h-80 rounded-2xl border border-slate-200 shadow-inner z-0 overflow-hidden"
      />
    </div>
  );
};
