import { environment } from '../../environments/environment';
import {
  getApp,
  getApps,
  initializeApp
} from 'firebase/app';

import {
  Auth,
  getAuth
} from 'firebase/auth';

const firebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        environment.firebase
      );

export const firebaseAuth: Auth =
  getAuth(firebaseApp);
