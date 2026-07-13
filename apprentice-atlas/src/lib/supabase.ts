import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const missingConfigMessage =
  'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the app environment.';

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(missingConfigMessage);
  }

  const auth =
    Platform.OS === 'web'
      ? {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        }
      : {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        };

  client = createClient(url, anonKey, { auth });
  return client;
}
