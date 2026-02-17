import { useQuery } from '@tanstack/react-query';
import { APIProvider } from '@vis.gl/react-google-maps';
import { mapsApi } from '../services/api';

interface Props {
  children: React.ReactNode;
}

export default function GoogleMapProvider({ children }: Props) {
  const { data: apiKey, isLoading, error } = useQuery({
    queryKey: ['google-maps-key'],
    queryFn: () => mapsApi.getApiKey().then(res => res.data.apiKey),
    staleTime: Infinity,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
        <span className="mr-3 text-gray-500">טוען מפות...</span>
      </div>
    );
  }

  if (error || !apiKey) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Google Maps API key לא מוגדר. הוסף GOOGLE_MAPS_API_KEY בהגדרות השרת.</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} language="he" region="IL">
      {children}
    </APIProvider>
  );
}
