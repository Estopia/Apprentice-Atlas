import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import { manualLocation, type ManualLocation } from '@/lib/location';

export { manualLocation } from '@/lib/location';
export type LocationState = { latitude: number; longitude: number } | ManualLocation | null;
export type LocationStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'manual';

export function useLocation() {
  const [location, setLocation] = useState<LocationState>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');

  const requestLocation = useCallback(async () => {
    setStatus('requesting');
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) { setStatus('unavailable'); return null; }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) { setStatus('denied'); return null; }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setLocation(next); setStatus('ready'); return next;
    } catch { setStatus('unavailable'); return null; }
  }, []);

  const setManualLocation = useCallback((city: string, country: string) => {
    const next = manualLocation(city, country);
    if (!next) return false;
    setLocation(next); setStatus('manual'); return true;
  }, []);

  return { location, status, requestLocation, setManualLocation };
}
