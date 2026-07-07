import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.malscan.app',
  appName: 'MalScan',
  webDir: 'out',
  // The app's WebView is served from https://localhost, but the backend
  // during local testing is plain http://<LAN IP> — without this, Android
  // silently blocks the fetch() as "mixed content" (same rule browsers
  // enforce), even though the backend is otherwise perfectly reachable.
  android: {
    allowMixedContent: true,
  },
};

export default config;
