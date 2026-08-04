/**
 * Build and device facts a bug report needs. Shared by the About screen and
 * the "Report a bug" row so a mailed report and a copied block never
 * disagree about which build the reporter was on.
 */
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";

export const SUPPORT_EMAIL = "support@orbitsocial.net";

const UNKNOWN = "unknown";

/** The version from app.json, which is what ships in the binary. */
export const appVersion = Constants.expoConfig?.version ?? UNKNOWN;

/**
 * The native build number, absent in Expo Go and absent until app.json sets
 * ios.buildNumber / android.versionCode. `Constants.platform.ios` reads the
 * embedded Info.plist, which cannot be changed by an over-the-air update, so
 * it is the more trustworthy of the two on iOS.
 */
export const buildNumber: string | null = (() => {
  if (Platform.OS === "ios") {
    return (
      Constants.platform?.ios?.buildNumber ??
      Constants.expoConfig?.ios?.buildNumber ??
      null
    );
  }
  if (Platform.OS === "android") {
    const versionCode = Constants.expoConfig?.android?.versionCode;
    return versionCode == null ? null : String(versionCode);
  }
  return null;
})();

export const expoSdkVersion = Constants.expoConfig?.sdkVersion ?? UNKNOWN;

/** Set when the build uses EAS Update; null on a plain development build. */
export const runtimeVersion = Constants.expoRuntimeVersion;

export const versionLabel = buildNumber
  ? `${appVersion} (${buildNumber})`
  : appVersion;

export function osLabel(): string {
  const name = Device.osName ?? Platform.OS;
  const version = Device.osVersion ?? String(Platform.Version);
  return `${name} ${version}`;
}

export function deviceLabel(): string {
  return Device.modelName ?? UNKNOWN;
}

/** Plain-text block, one fact per line, for pasting into an email or issue. */
export function diagnosticsText(): string {
  const lines = [
    `Orbit ${versionLabel}`,
    `Platform: ${Platform.OS}`,
    `OS: ${osLabel()}`,
    `Device: ${deviceLabel()}`,
    `Expo SDK: ${expoSdkVersion}`,
  ];
  if (runtimeVersion) lines.push(`Runtime: ${runtimeVersion}`);
  return lines.join("\n");
}

/** mailto: for a bug report, with the diagnostics block already in the body. */
export function bugReportUrl(): string {
  const subject = `Orbit bug report (${versionLabel})`;
  const body = `Describe what happened, what you expected, and the steps to repeat it.\n\n\n---\n${diagnosticsText()}`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
