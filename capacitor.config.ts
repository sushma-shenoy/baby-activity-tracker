import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Gigglebean',
  webDir: 'www',
  plugins: {
    LocalNotifications: {
      presentationOptions: [
        'badge',
        'sound',
        'banner',
        'list'
      ]
    }
  }
};

export default config;
