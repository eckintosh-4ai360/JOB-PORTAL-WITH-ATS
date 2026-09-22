import React, { useState, useEffect, useRef } from "react";
import { MapPin, Navigation, Search, Map, X, Check, Loader2, ExternalLink, Locate } from "lucide-react";

// Nominatim's usage policy allows roughly one request per second, so every
// keystroke-driven search is debounced by this much before it hits the network.
const SEARCH_DEBOUNCE_MS = 600;
const GHANA_BOUNDS = [[4.5, -3.3], [11.2, 1.3]];
const hasValidCoordinates = (latitude, longitude) =>
  latitude !== null &&
  latitude !== undefined &&
  latitude !== "" &&
  longitude !== null &&
  longitude !== undefined &&
  longitude !== "" &&
  Number.isFinite(Number(latitude)) &&
  Number.isFinite(Number(longitude));

export const LocationPicker = ({
  label = "Location",
  required = false,
  value = "",
  latitude = null,
  longitude = null,
  onChange,
  error = "",
  placeholder = "Search Ghana locations...",
}) => {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Coords state
  const [selectedCoords, setSelectedCoords] = useState(
    hasValidCoordinates(latitude, longitude)
      ? { lat: Number(latitude), lng: Number(longitude) }
      : null
  );

  // Modal State
  const [showMapModal, setShowMapModal] = useState(false);
  const [modalQuery, setModalQuery] = useState(value || "");
  const [modalCoords, setModalCoords] = useState(
    hasValidCoordinates(latitude, longitude)
      ? { lat: Number(latitude), lng: Number(longitude) }
      : { lat: 5.6037, lng: -0.1870 } // Default Accra
  );
  const [modalSuggestions, setModalSuggestions] = useState([]);
  const [isModalSearching, setIsModalSearching] = useState(false);
  // Only typing should trigger a search; map clicks and pin drags also write to
  // modalQuery, and those must not fire a request back at Nominatim.
  const [isModalTyping, setIsModalTyping] = useState(false);

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletMapInstance = useRef(null);
  const markerInstance = useRef(null);

  // Sync internal state when parent props change
  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    if (hasValidCoordinates(latitude, longitude)) {
      setSelectedCoords({ lat: Number(latitude), lng: Number(longitude) });
    } else {
      setSelectedCoords(null);
    }
  }, [latitude, longitude]);

  // Outside click listener for main dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for main input
  useEffect(() => {
    if (!query || query.trim().length < 3 || !showDropdown) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=gh&q=${encodeURIComponent(query)}&limit=5`
        );
        const data = await response.json();
        setSuggestions(data || []);
      } catch (err) {
        console.error("Location search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, showDropdown]);

  // Reverse geocode helper
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();
      return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  };

  // Main input selection
  const handleSelectSuggestion = (item) => {
    const formatted = item.display_name;
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);

    setQuery(formatted);
    setSelectedCoords({ lat, lng });
    setShowDropdown(false);

    if (onChange) {
      onChange({ location: formatted, latitude: lat, longitude: lng });
    }
  };

  // Detect location via GPS
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setSelectedCoords({ lat, lng });

        const addressName = await reverseGeocode(lat, lng);
        setQuery(addressName);

        if (onChange) {
          onChange({ location: addressName, latitude: lat, longitude: lng });
        }
        setIsGeolocating(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        alert("Could not retrieve location automatically. Please enter your address manually.");
        setIsGeolocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Manual typing in main input
  const handleInputChange = (e) => {
    const text = e.target.value;
    setQuery(text);
    setSelectedCoords(null);
    setShowDropdown(true);
    if (onChange) {
      onChange({
        location: text,
        latitude: null,
        longitude: null,
      });
    }
  };

  //  MAP MODAL LOGIC 
  const openModal = () => {
    setModalQuery(query || "");
    setIsModalTyping(false);
    setModalSuggestions([]);
    if (selectedCoords) {
      setModalCoords(selectedCoords);
    }
    setShowMapModal(true);
  };

  // Initialize interactive Leaflet map inside modal
  useEffect(() => {
    if (!showMapModal || !mapRef.current) return;

    // Load Leaflet CSS dynamically if not present
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const initMap = () => {
      if (!window.L || !mapRef.current) return;

      // Destroy existing map instance if any
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }

      const initialLat = modalCoords?.lat || 5.6037;
      const initialLng = modalCoords?.lng || -0.1870;

      const map = window.L.map(mapRef.current, {
        maxBounds: GHANA_BOUNDS,
        maxBoundsViscosity: 1.0,
      }).setView([initialLat, initialLng], 14);
      leafletMapInstance.current = map;

      // Add OpenStreetMap tile layer (Clean & crisp look)
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Add draggable pin marker
      const marker = window.L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
      markerInstance.current = marker;

      // Update location when pin marker is dragged
      marker.on("dragend", async () => {
        const position = marker.getLatLng();
        const lat = position.lat;
        const lng = position.lng;
        setModalCoords({ lat, lng });

        const address = await reverseGeocode(lat, lng);
        setIsModalTyping(false);
        setModalSuggestions([]);
        setModalQuery(address);
      });

      // Update location when map is clicked
      map.on("click", async (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setModalCoords({ lat, lng });

        const address = await reverseGeocode(lat, lng);
        setIsModalTyping(false);
        setModalSuggestions([]);
        setModalQuery(address);
      });

      // Trigger map resize after modal render
      setTimeout(() => map.invalidateSize(), 200);
    };

    // Load Leaflet JS dynamically if not present
    if (!window.L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = initMap;
      document.body.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, [showMapModal]);

  // Handle modal search suggestion selection
  const handleModalSelectSuggestion = (item) => {
    const formatted = item.display_name;
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);

    setModalQuery(formatted);
    setIsModalTyping(false);
    setModalCoords({ lat, lng });
    setModalSuggestions([]);

    if (leafletMapInstance.current && markerInstance.current) {
      leafletMapInstance.current.setView([lat, lng], 16);
      markerInstance.current.setLatLng([lat, lng]);
    }
  };

  // Modal search typing; the request itself is debounced in the effect below.
  const handleModalSearchChange = (e) => {
    const val = e.target.value;
    setModalQuery(val);
    setIsModalTyping(true);
    if (val.trim().length < 3) setModalSuggestions([]);
  };

  // Debounced search for modal input
  useEffect(() => {
    if (!isModalTyping || modalQuery.trim().length < 3) return;

    const timer = setTimeout(async () => {
      setIsModalSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=gh&q=${encodeURIComponent(modalQuery)}&limit=5`
        );
        const data = await response.json();
        setModalSuggestions(data || []);
      } catch (err) {
        console.error("Modal search error:", err);
      } finally {
        setIsModalSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [modalQuery, isModalTyping]);

  // Confirm map location button
  const handleConfirmLocation = () => {
    const finalLocation = modalQuery.trim() || query.trim();
    const finalLat = modalCoords?.lat || selectedCoords?.lat || null;
    const finalLng = modalCoords?.lng || selectedCoords?.lng || null;

    setQuery(finalLocation);
    setSelectedCoords(finalLat && finalLng ? { lat: finalLat, lng: finalLng } : null);
    setShowMapModal(false);

    if (onChange) {
      onChange({
        location: finalLocation,
        latitude: finalLat,
        longitude: finalLng,
      });
    }
  };

  const googleMapsSearchUrl = selectedCoords
    ? `https://www.google.com/maps/search/?api=1&query=${selectedCoords.lat},${selectedCoords.lng}`
    : query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : "https://maps.google.com";

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label} {required && <span className="text-red-500 dark:text-red-400">*</span>}
          </label>
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
            <Map className="h-3 w-3" /> Search by
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              OpenStreetMap
            </a>
          </span>
        </div>
      )}

      {/* Main input container */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
          <MapPin className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
        </div>

        <input
          type="text"
          required={required}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-24 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 ${
            error ? "border-red-400 focus:border-red-400" : ""
          }`}
        />

        {/* Action buttons inside input */}
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {/* Detect location button */}
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={isGeolocating}
            title="Use current GPS location"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition active:scale-95 disabled:opacity-50 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
          >
            {isGeolocating ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </button>

          {/* Open interactive map modal button */}
          <button
            type="button"
            onClick={openModal}
            title="Open Interactive Map Locator"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition active:scale-95 shadow-xs"
          >
            <Map className="h-4 w-4" />
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl animate-in fade-in duration-150 dark:border-gray-800 dark:bg-gray-900">
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs transition hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
                <span className="line-clamp-2 text-gray-700 font-medium dark:text-gray-300">
                  {item.display_name}
                </span>
              </button>
            ))}
          </div>
        )}

        {isSearching && showDropdown && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-gray-100 bg-white p-3 shadow-xl flex items-center gap-2 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
            <span>Finding location details...</span>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      {/* Selected location coordinates badge */}
      {selectedCoords && (
        <div className="flex items-center justify-between text-[11px] text-gray-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 dark:text-gray-500 dark:bg-gray-800 dark:border-gray-700">
          <span className="flex items-center gap-1.5 font-medium">
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            Pinned Location ({selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)})
          </span>
          <a
            href={googleMapsSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold dark:text-indigo-400"
          >
            Open in Google Maps <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Interactive Map Picker Modal */}
      {showMapModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 dark:bg-gray-900 dark:border-gray-800">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <Map className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold">Interactive Map Pinpoint</h3>
                  <p className="text-xs text-slate-300">
                    Click anywhere on map or drag pin to choose exact location
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-100 relative dark:bg-gray-900 dark:border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={modalQuery}
                  onChange={handleModalSearchChange}
                  placeholder="Search a place or address to focus map..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </div>

              {/* Modal Search Dropdown */}
              {modalSuggestions.length > 0 && (
                <div className="absolute left-3 right-3 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                  {modalSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleModalSelectSuggestion(item)}
                      className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-xs hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                    >
                      <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5 dark:text-indigo-400" />
                      <span className="truncate text-gray-700 font-medium dark:text-gray-300">{item.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Interactive Leaflet Map Container */}
            <div className="relative h-80 w-full bg-slate-100 dark:bg-gray-800">
              <div ref={mapRef} className="h-full w-full z-0" />
              <div className="absolute top-3 right-3 z-[400] bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm text-[11px] font-semibold text-gray-700 flex items-center gap-1.5 dark:bg-gray-900/90 dark:border-gray-700 dark:text-gray-300">
                <Locate className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                Drag marker or click map
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-white border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 dark:bg-gray-900 dark:border-gray-800">
              <div className="text-xs text-gray-600 font-medium text-center sm:text-left min-w-0 flex-1 dark:text-gray-300">
                <p className="font-bold text-gray-900 truncate dark:text-gray-100">{modalQuery || "Click map to select location"}</p>
                <p className="text-gray-400 text-[11px] mt-0.5 dark:text-gray-500">
                  Coords: {modalCoords.lat.toFixed(5)}, {modalCoords.lng.toFixed(5)}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button
                  type="button"
                  onClick={() => setShowMapModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLocation}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-bold text-white transition shadow-md shadow-indigo-100 dark:shadow-none flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  Confirm Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
