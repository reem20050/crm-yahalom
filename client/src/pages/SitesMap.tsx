import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { MapPin, Search, Navigation, Building2, Shield, RefreshCw, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import GoogleMapProvider from '../components/GoogleMapProvider';
import { sitesGlobalApi } from '../services/api';

interface Site {
  id: string;
  customer_id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  requires_weapon: number;
  requirements: string;
  company_name: string;
  geofence_radius_meters: number;
}

function SitesMapContent() {
  const queryClient = useQueryClient();
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['sites-with-coordinates'],
    queryFn: () => sitesGlobalApi.getWithCoordinates().then(res => res.data),
  });

  const { data: allSites = [] } = useQuery({
    queryKey: ['sites-all'],
    queryFn: () => sitesGlobalApi.getAll().then(res => res.data),
  });

  const geocodeAllMutation = useMutation({
    mutationFn: () => sitesGlobalApi.geocodeAll(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sites-with-coordinates'] });
      queryClient.invalidateQueries({ queryKey: ['sites-all'] });
      toast.success(`${res.data.success} אתרים עודכנו, ${res.data.failed} נכשלו`);
    },
    onError: () => toast.error('שגיאה ב-geocoding'),
  });

  const sitesWithoutCoords = allSites.length - sites.length;

  const filteredSites = sites.filter((site: Site) =>
    !searchTerm ||
    site.name.includes(searchTerm) ||
    site.company_name.includes(searchTerm) ||
    site.city?.includes(searchTerm) ||
    site.address?.includes(searchTerm)
  );

  const openNavigation = useCallback((lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  }, []);

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-3">אתרים ({sites.length})</h2>
            <div className="relative">
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חיפוש אתר..."
                className="input pr-10 text-sm"
              />
            </div>
            {sitesWithoutCoords > 0 && (
              <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700 mb-2">
                  {sitesWithoutCoords} אתרים בלי קואורדינטות
                </p>
                <button
                  onClick={() => geocodeAllMutation.mutate()}
                  disabled={geocodeAllMutation.isPending}
                  className="btn-primary text-xs px-2 py-1 flex items-center gap-1"
                >
                  {geocodeAllMutation.isPending ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <MapPin className="w-3 h-3" />
                  )}
                  עדכן קואורדינטות
                </button>
              </div>
            )}
          </div>

          <div className="divide-y divide-gray-100">
            {filteredSites.map((site: Site) => (
              <button
                key={site.id}
                onClick={() => setSelectedSite(site)}
                className={`w-full text-right p-3 hover:bg-gray-50 transition-colors ${
                  selectedSite?.id === site.id ? 'bg-primary-50 border-r-2 border-primary-500' : ''
                }`}
              >
                <p className="font-medium text-sm text-gray-900">{site.name}</p>
                <p className="text-xs text-gray-500">{site.company_name}</p>
                <p className="text-xs text-gray-400 mt-1">{site.address}, {site.city}</p>
                {site.requires_weapon === 1 && (
                  <span className="inline-flex items-center gap-1 mt-1 text-xs text-red-600">
                    <Shield className="w-3 h-3" /> דורש נשק
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-3 right-3 z-10 bg-white shadow-lg rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {sidebarOpen ? 'הסתר רשימה' : 'הצג רשימה'}
        </button>

        <Map
          defaultCenter={{ lat: 31.5, lng: 34.8 }}
          defaultZoom={8}
          gestureHandling="greedy"
          className="w-full h-full"
          mapId="b7ef17e439471657dd56ff74"
        >
          {filteredSites.map((site: Site) => (
            <Marker
              key={site.id}
              position={{ lat: site.latitude, lng: site.longitude }}
              onClick={() => setSelectedSite(site)}
              title={site.name}
            />
          ))}

          {selectedSite && (
            <InfoWindow
              position={{ lat: selectedSite.latitude, lng: selectedSite.longitude }}
              onCloseClick={() => setSelectedSite(null)}
            >
              <div className="p-2 min-w-[200px]" dir="rtl">
                <h3 className="font-bold text-gray-900">{selectedSite.name}</h3>
                <p className="text-sm text-primary-600 mb-1">{selectedSite.company_name}</p>
                <p className="text-sm text-gray-600">{selectedSite.address}, {selectedSite.city}</p>

                {selectedSite.requires_weapon === 1 && (
                  <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                    <Shield className="w-3 h-3" /> דורש נשק
                  </p>
                )}
                {selectedSite.requirements && (
                  <p className="text-xs text-gray-500 mt-1">{selectedSite.requirements}</p>
                )}

                <div className="flex gap-2 mt-3">
                  <Link
                    to={`/customers/${selectedSite.customer_id}`}
                    className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> פרטי לקוח
                  </Link>
                  <button
                    onClick={() => openNavigation(selectedSite.latitude, selectedSite.longitude)}
                    className="text-xs text-green-600 hover:underline flex items-center gap-1"
                  >
                    <Navigation className="w-3 h-3" /> ניווט
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </div>
  );
}

export default function SitesMap() {
  return (
    <GoogleMapProvider>
      <SitesMapContent />
    </GoogleMapProvider>
  );
}
