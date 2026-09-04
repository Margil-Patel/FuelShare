'use client';

import React, { useState, useEffect, useRef } from 'react';
import { searchLocationsApi } from '@/lib/api/location';
import { LocationSearchResult } from '@/lib/api/types';

interface LocationAutocompleteProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSelectLocation: (location: { name: string; latitude: number; longitude: number }) => void;
  city?: string;
  required?: boolean;
  className?: string;
  helperText?: string;
}

export const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  label,
  placeholder = 'Type to search location or click on map...',
  value,
  onChange,
  onSelectLocation,
  city,
  required = false,
  className = '',
  helperText,
}) => {
  const [suggestions, setSuggestions] = useState<LocationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchLocationsApi(value, city);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, city]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: LocationSearchResult) => {
    onChange(item.name);
    onSelectLocation({
      name: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
    });
    setShowDropdown(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          required={required}
          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs transition-all pr-10"
        />

        {loading ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-indigo-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">
            📍
          </div>
        )}
      </div>

      {helperText && <p className="text-xs text-slate-500 mt-1">{helperText}</p>}

      {/* Autocomplete Dropdown List */}
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
          {suggestions.map((item, idx) => (
            <li
              key={`${item.latitude}-${item.longitude}-${idx}`}
              onClick={() => handleSelect(item)}
              className="p-3 hover:bg-indigo-50 cursor-pointer transition-colors flex items-start gap-2.5"
            >
              <span className="text-indigo-600 font-bold text-sm mt-0.5">📍</span>
              <div className="flex-1">
                <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                <div className="text-slate-500 text-xs line-clamp-1">{item.display_name}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
