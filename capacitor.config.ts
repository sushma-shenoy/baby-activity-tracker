import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.sushma.starter',
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
