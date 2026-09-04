'use client';

import React, { useEffect, useRef } from 'react';

interface LatLng {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

interface RouteMapProps {
  /** Encoded polyline string (Google/OSRM precision-5) for the main route A→B */
  routePolyline?: string | null;
  /** Fallback: use these two points as a straight-line route */
  origin?: LatLng;
  destination?: LatLng;
  /** Passenger pickup C */
  pickup?: LatLng;
  /** Passenger drop D */
  drop?: LatLng;
  /** Extra passenger markers (for rider view showing multiple passengers) */
  passengerMarkers?: Array<{ pickup: LatLng; drop: LatLng; label?: string }>;
  /** Buffer distance in meters – used to draw an approximate buffer ring */
  bufferM?: number;
  height?: string;
  className?: string;
}

/**
 * RouteMap renders an interactive Leaflet map showing:
 *  - The driver's route polyline (A→B) in indigo
 *  - Origin (A) and destination (B) markers
 *  - Passenger pickup (C) and drop (D) markers
 *  - An approximate corridor buffer ring
 *
 * Uses dynamic import inside useEffect to avoid SSR issues with Leaflet.
 */
let isLeafletDomUtilPatched = false;

function patchLeafletDomUtil(L: any) {
  if (!L || isLeafletDomUtilPatched) return;
  isLeafletDomUtilPatched = true;

  try {
    const DomUtil = L.DomUtil || (L.default && L.default.DomUtil);
    if (DomUtil) {
      DomUtil.getSizedParentNode = function (element: any) {
        if (!element) return typeof document !== 'undefined' ? document.body : null;
        let curr = element.parentNode || element;
        while (curr && typeof document !== 'undefined' && curr !== document.body && curr !== document) {
          if (curr.offsetWidth && curr.offsetHeight) {
            return curr;
          }
          curr = curr.parentNode;
        }
        return typeof document !== 'undefined' ? document.body || element : element;
      };

      DomUtil.getScale = function (element: any) {
        if (!element || !element.getBoundingClientRect) {
          return { x: 1, y: 1, boundingClientRect: { width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0 } };
        }
        try {
          const rect = element.getBoundingClientRect();
          return {
            x: element.offsetWidth ? rect.width / element.offsetWidth || 1 : 1,
            y: element.offsetHeight ? rect.height / element.offsetHeight || 1 : 1,
            boundingClientRect: rect,
          };
        } catch {
          return { x: 1, y: 1, boundingClientRect: { width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0 } };
        }
      };
    }

    const Draggable = L.Draggable || (L.default && L.default.Draggable);
    if (Draggable && Draggable.prototype) {
      const origOnDown = Draggable.prototype._onDown;
      Draggable.prototype._onDown = function (e: any) {
        if (!this._element) return;
        try {
          if (origOnDown) origOnDown.call(this, e);
        } catch {
          // Suppress drag error if element is detached/unmeasured
        }
      };
    }
  } catch {
    // Ignore patching errors in strict/sealed ESM environments
  }
}

export const RouteMap: React.FC<RouteMapProps> = ({
  routePolyline,
  origin,
  destination,
  pickup,
  drop,
  passengerMarkers = [],
  bufferM = 500,
  height = '320px',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    if (!containerRef.current || mapRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current || mapRef.current) return;
      patchLeafletDomUtil(L);

      // Inject Leaflet CSS if not already present
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Fix default icon URLs broken by webpack
      try {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      } catch {
        // ignore
      }

      // Clear any previous leaflet instance from container
      if ((containerRef.current as any)._leaflet_id) {
        try {
          delete (containerRef.current as any)._leaflet_id;
        } catch {
          // ignore
        }
      }

      let map: any = null;
      try {
        map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false });
        mapRef.current = map;
      } catch {
        // Already initialized or double-mounted
        return;
      }

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const renderRouteAndMarkers = async () => {
        const allPoints: L.LatLng[] = [];

        // --- Decode or fetch the driving route polyline ---
        let routeCoords: L.LatLng[] = [];

        if (routePolyline && routePolyline.trim().length > 0) {
          routeCoords = decodePolyline(routePolyline).map(([lat, lng]) => L.latLng(lat, lng));
        } else if (origin && destination) {
          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
              const coords = data.routes[0].geometry.coordinates;
              routeCoords = coords.map(([lon, lat]: [number, number]) => L.latLng(lat, lon));
            }
          } catch {
            // fallback below
          }
          if (routeCoords.length === 0) {
            routeCoords = [L.latLng(origin.lat, origin.lng), L.latLng(destination.lat, destination.lng)];
          }
        }

        if (routeCoords.length > 0 && mapRef.current) {
          allPoints.push(...routeCoords);

          // Route casing
          L.polyline(routeCoords, {
            color: '#1e1b4b',
            weight: 7,
            opacity: 0.5,
            lineJoin: 'round',
            lineCap: 'round',
          }).addTo(map);

          // Route polyline in vibrant indigo
          L.polyline(routeCoords, {
            color: '#4F46E5',
            weight: 4.5,
            opacity: 0.95,
            lineJoin: 'round',
            lineCap: 'round',
          }).addTo(map);

          // Buffer approximation: draw dashed lines offset from route
          L.polyline(routeCoords, {
            color: '#818CF8',
            weight: Math.max(8, bufferM / 50),
            opacity: 0.15,
          }).addTo(map);
        }

        // --- Origin marker (A) — green ---
        const originPt = origin ?? (routeCoords[0] ? { lat: routeCoords[0].lat, lng: routeCoords[0].lng } : null);
        if (originPt && mapRef.current) {
          const greenIcon = L.divIcon({
            html: `<div style="background:#10B981;border:2px solid white;border-radius:50%;width:14px;height:14px;box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>`,
            className: '',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          L.marker([originPt.lat, originPt.lng], { icon: greenIcon })
            .bindTooltip(`<b>Origin:</b> ${origin?.label ?? 'Origin'}`, { direction: 'top' })
            .addTo(map);
          allPoints.push(L.latLng(originPt.lat, originPt.lng));
        }

        // --- Destination marker — red ---
        const destPt = destination ?? (routeCoords.length > 1 ? { lat: routeCoords[routeCoords.length - 1].lat, lng: routeCoords[routeCoords.length - 1].lng } : null);
        if (destPt && mapRef.current) {
          const redIcon = L.divIcon({
            html: `<div style="background:#EF4444;border:2px solid white;border-radius:50%;width:14px;height:14px;box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>`,
            className: '',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          L.marker([destPt.lat, destPt.lng], { icon: redIcon })
            .bindTooltip(`<b>Destination:</b> ${destination?.label ?? 'Destination'}`, { direction: 'top' })
            .addTo(map);
          allPoints.push(L.latLng(destPt.lat, destPt.lng));
        }

        // --- Pickup marker — orange ---
        if (pickup && mapRef.current) {
          const orangeIcon = L.divIcon({
            html: `<div style="background:#F97316;border:2px solid white;border-radius:4px;width:14px;height:14px;box-shadow:0 2px 4px rgba(0,0,0,0.4);transform:rotate(45deg)"></div>`,
            className: '',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          L.marker([pickup.lat, pickup.lng], { icon: orangeIcon })
            .bindTooltip(`<b>Pickup Location:</b> ${pickup.label ?? 'Your pickup'}`, { direction: 'top' })
            .addTo(map);
          allPoints.push(L.latLng(pickup.lat, pickup.lng));
        }

        // --- Drop-off marker — purple ---
        if (drop && mapRef.current) {
          const purpleIcon = L.divIcon({
            html: `<div style="background:#7C3AED;border:2px solid white;border-radius:4px;width:14px;height:14px;box-shadow:0 2px 4px rgba(0,0,0,0.4);transform:rotate(45deg)"></div>`,
            className: '',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          L.marker([drop.lat, drop.lng], { icon: purpleIcon })
            .bindTooltip(`<b>Drop-off Location:</b> ${drop.label ?? 'Your drop-off'}`, { direction: 'top' })
            .addTo(map);
          allPoints.push(L.latLng(drop.lat, drop.lng));
        }

        // --- Additional passenger markers (rider view) ---
        passengerMarkers.forEach((pm, idx) => {
          if (!mapRef.current) return;
          const pPickupIcon = L.divIcon({
            html: `<div style="background:#F97316;border:2px solid white;width:11px;height:11px;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
            className: '',
            iconSize: [11, 11],
            iconAnchor: [5, 5],
          });
          const pDropIcon = L.divIcon({
            html: `<div style="background:#7C3AED;border:2px solid white;width:11px;height:11px;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
            className: '',
            iconSize: [11, 11],
            iconAnchor: [5, 5],
          });
          L.marker([pm.pickup.lat, pm.pickup.lng], { icon: pPickupIcon })
            .bindTooltip(`<b>Passenger ${idx + 1} pickup</b>${pm.label ? `<br>${pm.label}` : ''}`, { direction: 'top' })
            .addTo(map);
          L.marker([pm.drop.lat, pm.drop.lng], { icon: pDropIcon })
            .bindTooltip(`<b>Passenger ${idx + 1} drop</b>`, { direction: 'top' })
            .addTo(map);

          // Dashed line connecting passenger pickup to drop
          L.polyline([[pm.pickup.lat, pm.pickup.lng], [pm.drop.lat, pm.drop.lng]], {
            color: '#F97316',
            weight: 2,
            dashArray: '5,5',
            opacity: 0.7,
          }).addTo(map);

          allPoints.push(L.latLng(pm.pickup.lat, pm.pickup.lng));
          allPoints.push(L.latLng(pm.drop.lat, pm.drop.lng));
        });

        // Fit map to all points
        if (allPoints.length > 0 && mapRef.current) {
          map.fitBounds(L.latLngBounds(allPoints), { padding: [32, 32] });
        } else if (mapRef.current) {
          map.setView([23.02, 72.57], 12);
        }
      };

      renderRouteAndMarkers();
    });

    return () => {
      isMounted = false;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className={`rounded-xl overflow-hidden border border-slate-200 shadow-sm ${className}`}
    />
  );
};

/**
 * Pure-JS Google/OSRM precision-5 polyline decoder.
 * Returns array of [lat, lng] tuples.
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
