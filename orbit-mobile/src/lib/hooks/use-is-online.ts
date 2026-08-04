import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

/**
 * Device connectivity, biased to online so the first NetInfo read never
 * flashes an offline state on a healthy connection.
 */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      // isInternetReachable stays null while the reachability probe is in
      // flight, and a captive portal reports connected but unreachable; only
      // a definite false counts as offline.
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
  }, []);

  return online;
}
