import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dunvex.build',
  appName: 'Dunvex Build',
  webDir: 'dist',
  server: {
    // Dùng localhost để tránh CORS, Capacitor sẽ load từ assets
    androidScheme: 'https'
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
