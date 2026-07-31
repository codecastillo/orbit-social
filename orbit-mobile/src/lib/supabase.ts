import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: string; supabaseKey?: string }
  | undefined;

const url = extra?.supabaseUrl;
const key = extra?.supabaseKey;

if (!url || !key) {
  throw new Error(
    "Missing supabaseUrl/supabaseKey in app.json extra; the app cannot reach the backend without them.",
  );
}

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No browser URL to parse on native.
    detectSessionInUrl: false,
  },
});
