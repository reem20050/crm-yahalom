import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigation } from 'lucide-react';
import { shiftsApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export default function LocationReporter() {
  const user = useAuthStore((s) => s.user);
  const [isTracking, setIsTracking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check for active assignments (employee role only)
  const { data: activeAssignment } = useQuery({
    queryKey: ['my-active-assignment'],
    queryFn: async () => {
      // Get today's shifts for the current user
      const today = new Date().toISOString().split('T')[0];
      const res = await shiftsApi.getAll({ start_date: today, end_date: today });
      const shifts = res.data?.shifts || res.data || [];
      // Find a checked-in assignment for the current user
      for (const shift of shifts) {
        if (shift.assignments) {
          const myAssignment = shift.assignments.find(
            (a: any) => a.status === 'checked_in' && a.employee_id === user?.employeeId
          );
          if (myAssignment) return myAssignment;
        }
      }
      return null;
    },
    refetchInterval: 60000, // Check every minute
    enabled: !!user?.employeeId, // Only for employees
  });

  const reportLocation = useCallback(async (assignmentId: string) => {
    if (!navigator.geolocation) return;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        });
      });

      await shiftsApi.locationReport({
        shift_assignment_id: assignmentId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    } catch (e) {
      // Silent fail - location reporting is best-effort
      console.warn('Location report failed:', e);
    }
  }, []);

  useEffect(() => {
    if (activeAssignment?.id) {
      setIsTracking(true);
      // Report immediately
      reportLocation(activeAssignment.id);
      // Then every 5 minutes
      intervalRef.current = setInterval(() => {
        reportLocation(activeAssignment.id);
      }, 5 * 60 * 1000);
    } else {
      setIsTracking(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeAssignment?.id, reportLocation]);

  if (!isTracking) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-green-500 text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-medium animate-pulse">
      <Navigation className="w-3.5 h-3.5" />
      GPS פעיל
    </div>
  );
}
