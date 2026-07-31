import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
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
    // AsyncStorage only exists in the native runtime; Expo's static web
    // rendering evaluates this module under Node and crashes the dev server
    // if it touches it. React Native defines window, Node does not.
    storage: typeof window === "undefined" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No browser URL to parse on native.
    detectSessionInUrl: false,
    // Without an explicit lock, getSession can stall for seconds on React
    // Native cold start while auth-js waits on the default lock.
    lock: processLock,
  },
});
