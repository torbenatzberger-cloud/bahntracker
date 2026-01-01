import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase Konfiguration
const SUPABASE_URL = 'https://xkahmlbtlnmqicjnnndy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrYWhtbGJ0bG5tcWljam5ubmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyNjU5OTUsImV4cCI6MjA4Mjg0MTk5NX0.1aFfFcMYv6lg4A5FXcCBg6wsEdk-0BGZmqrPNI22nSE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
  },
});

const DEVICE_ID_KEY = 'bahntracker_device_id';

// Generiert oder holt eine eindeutige Geräte-ID
export async function getDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Generiere eine neue UUID für dieses Gerät
    deviceId = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);

    // Registriere das Gerät in Supabase
    await supabase.from('devices').upsert({
      device_id: deviceId,
      last_seen_at: new Date().toISOString(),
    });
  } else {
    // Aktualisiere last_seen_at
    await supabase.from('devices').upsert({
      device_id: deviceId,
      last_seen_at: new Date().toISOString(),
    });
  }

  return deviceId;
}

// Prüft ob Supabase konfiguriert ist
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 50;
}
