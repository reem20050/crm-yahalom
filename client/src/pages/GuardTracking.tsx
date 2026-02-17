import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import { Navigation, User, Clock, MapPin, AlertCircle } from 'lucide-react';
import GoogleMapProvider from '../components/GoogleMapProvider';
import { shiftsApi, sitesGlobalApi } from '../services/api';

interface ActiveGuard {
  assignment_id: string;
  employee_id: string;
  employee_name: string;
  site_id: string;
  site_name: string;
  site_address: string;
  site_latitude: number;
  site_longitude: number;
  company_name: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  recorded_at: string | null;
}

function minutesAgo(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  return Math.round((Date.now() - new Date(dateStr + 'Z').getTime()) / 60000);
}

function GuardTrackingContent() {
  const [selectedGuard, setSelectedGuard] = useState<ActiveGuard | null>(null);

  const { data: guards = [], isLoading } = useQuery({
    queryKey: ['active-guards'],
    queryFn: () => shiftsApi.getActiveGuards().then(res => res.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['sites-with-coordinates'],
    queryFn: () => sitesGlobalApi.getWithCoordinates().then(res => res.data),
  });

  const guardsWithLocation = guards.filter((g: ActiveGuard) => g.latitude && g.longitude);
  const guardsWithoutLocation = guards.filter((g: ActiveGuard) => !g.latitude || !g.longitude);

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar */}
      <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary-600" />
            מעקב שומרים
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {guards.length} שומרים פעילים
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></div>
          </div>
        ) : guards.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>אין שומרים פעילים כרגע</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {guards.map((guard: ActiveGuard) => {
              const mins = minutesAgo(guard.recorded_at);
              const isRecent = mins < 10;
              const isStale = mins >= 10 && mins < 60;
              const noLocation = !guard.latitude;

              return (
                <button
                  key={guard.assignment_id}
                  onClick={() => setSelectedGuard(guard)}
                  className={`w-full text-right p-3 hover:bg-gray-50 transition-colors ${
                    selectedGuard?.assignment_id === guard.assignment_id ? 'bg-primary-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      noLocation ? 'bg-gray-400' : isRecent ? 'bg-green-500' : isStale ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                    <p className="font-medium text-sm text-gray-900">{guard.employee_name}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{guard.site_name} - {guard.company_name}</p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {noLocation ? 'אין מיקום' : isRecent ? `לפני ${mins} דקות` : `לפני ${mins} דקות`}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <Map
          defaultCenter={{ lat: 31.5, lng: 34.8 }}
          defaultZoom={8}
          gestureHandling="greedy"
          mapId="guard-tracking-map"
          className="w-full h-full"
        >
          {/* Site markers (smaller, gray) */}
          {sites.map((site: any) => (
            <AdvancedMarker
              key={`site-${site.id}`}
              position={{ lat: site.latitude, lng: site.longitude }}
              title={site.name}
            >
              <div className="w-5 h-5 rounded-full bg-gray-300 border border-white shadow flex items-center justify-center">
                <MapPin className="w-3 h-3 text-gray-600" />
              </div>
            </AdvancedMarker>
          ))}

          {/* Guard markers */}
          {guardsWithLocation.map((guard: ActiveGuard) => {
            const mins = minutesAgo(guard.recorded_at);
            const isRecent = mins < 10;
            const bgColor = isRecent ? 'bg-blue-500' : 'bg-amber-500';

            return (
              <AdvancedMarker
                key={guard.assignment_id}
                position={{ lat: guard.latitude!, lng: guard.longitude! }}
                onClick={() => setSelectedGuard(guard)}
                title={guard.employee_name}
              >
                <div className={`w-9 h-9 rounded-full ${bgColor} border-2 border-white shadow-lg flex items-center justify-center`}>
                  <User className="w-4 h-4 text-white" />
                </div>
              </AdvancedMarker>
            );
          })}

          {selectedGuard && selectedGuard.latitude && selectedGuard.longitude && (
            <InfoWindow
              position={{ lat: selectedGuard.latitude, lng: selectedGuard.longitude }}
              onCloseClick={() => setSelectedGuard(null)}
            >
              <div className="p-2 min-w-[180px]" dir="rtl">
                <h3 className="font-bold text-gray-900">{selectedGuard.employee_name}</h3>
                <p className="text-sm text-gray-600">{selectedGuard.site_name}</p>
                <p className="text-xs text-gray-500">{selectedGuard.company_name}</p>
                {selectedGuard.recorded_at && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    עדכון לפני {minutesAgo(selectedGuard.recorded_at)} דקות
                  </p>
                )}
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </div>
  );
}

export default function GuardTracking() {
  return (
    <GoogleMapProvider>
      <GuardTrackingContent />
    </GoogleMapProvider>
  );
}
