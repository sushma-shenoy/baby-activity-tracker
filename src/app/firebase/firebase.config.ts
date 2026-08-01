import { environment } from '../../environments/environment';
import {
  getApp,
  getApps,
  initializeApp
} from 'firebase/app';

import {
  Auth,
  browserLocalPersistence,
  initializeAuth
} from 'firebase/auth';

export const firebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        environment.firebase
      );

export const firebaseAuth: Auth =
  initializeAuth(firebaseApp, {
    persistence: browserLocalPersistence
  });
