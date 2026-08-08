import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sushma.gigglebean',
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
