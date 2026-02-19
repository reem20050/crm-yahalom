import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
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

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = { lat: 31.5, lng: 34.8 };

const siteIcon = {
  url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="%239CA3AF" stroke="white" stroke-width="2"/></svg>'),
  scaledSize: { width: 20, height: 20 } as google.maps.Size,
};

function getGuardIcon(isRecent: boolean) {
  const color = isRecent ? '%233B82F6' : '%23F59E0B';
  return {
    url: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="3"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="14">&#x1F464;</text></svg>`),
    scaledSize: { width: 32, height: 32 } as google.maps.Size,
  };
}

function GuardTrackingContent() {
  const [selectedGuard, setSelectedGuard] = useState<ActiveGuard | null>(null);

  const { data: guards = [], isLoading } = useQuery({
    queryKey: ['active-guards'],
    queryFn: () => shiftsApi.getActiveGuards().then(res => res.data),
    refetchInterval: 30000,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['sites-with-coordinates'],
    queryFn: () => sitesGlobalApi.getWithCoordinates().then(res => res.data),
  });

  const guardsWithLocation = guards.filter((g: ActiveGuard) => g.latitude && g.longitude);

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar */}
      <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 font-heading flex items-center gap-2">
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
                    {noLocation ? 'אין מיקום' : `לפני ${mins} דקות`}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={8}
          options={{
            gestureHandling: 'greedy',
          }}
        >
          {/* Site markers (smaller, gray) */}
          {sites.map((site: any) => (
            <Marker
              key={`site-${site.id}`}
              position={{ lat: site.latitude, lng: site.longitude }}
              title={site.name}
              icon={siteIcon}
            />
          ))}

          {/* Guard markers */}
          {guardsWithLocation.map((guard: ActiveGuard) => {
            const mins = minutesAgo(guard.recorded_at);
            const isRecent = mins < 10;

            return (
              <Marker
                key={guard.assignment_id}
                position={{ lat: guard.latitude!, lng: guard.longitude! }}
                onClick={() => setSelectedGuard(guard)}
                title={guard.employee_name}
                icon={getGuardIcon(isRecent)}
              />
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
        </GoogleMap>
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
