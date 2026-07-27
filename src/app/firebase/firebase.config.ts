import { environment } from '../../environments/environment';
import {
  FirebaseApp,
  getApp,
  getApps,
  initializeApp
} from 'firebase/app';

import {
  Auth,
  getAuth
} from 'firebase/auth';

import {
  Firestore,
  getFirestore
} from 'firebase/firestore';

import {
  FirebaseStorage,
  getStorage
} from 'firebase/storage';



const firebaseApp: FirebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        environment.firebase
      );

export const firebaseAuth: Auth =
  getAuth(firebaseApp);

export const firestore: Firestore =
  getFirestore(firebaseApp);

export const firebaseStorage:
  FirebaseStorage =
    getStorage(firebaseApp);

export { firebaseApp };