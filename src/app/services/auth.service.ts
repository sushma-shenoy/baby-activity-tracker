import {
  Injectable
} from '@angular/core';

import {
  BehaviorSubject,
  Observable,
  filter,
  firstValueFrom,
  take
} from 'rxjs';

import {
  AuthError,
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';

import {
  firebaseAuth
} from '../firebase/firebase.config';

import {
  AuthResult
} from './../shared/models/auth-result.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private static readonly AUTH_READY_TIMEOUT_MS = 5000;
  private static readonly AUTH_REQUEST_TIMEOUT_MS = 10000;

  private readonly currentUserSubject =
    new BehaviorSubject<User | null>(null);

  private readonly authReadySubject =
    new BehaviorSubject<boolean>(false);

  readonly currentUser$: Observable<User | null> =
    this.currentUserSubject.asObservable();

  readonly authReady$: Observable<boolean> =
    this.authReadySubject.asObservable();

  constructor() {
    this.initializeAuthentication();
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return this.currentUser !== null;
  }

  waitUntilReady(): Promise<void> {
    if (this.authReadySubject.value) {
      return Promise.resolve();
    }

    const authStateReady = firstValueFrom(
      this.authReady$.pipe(
        filter(Boolean),
        take(1)
      )
    ).then(() => undefined);

    const startupTimeout = new Promise<void>((resolve) => {
      window.setTimeout(() => {
        if (!this.authReadySubject.value) {
          console.warn(
            'Firebase authentication startup timed out. Continuing signed out.'
          );
        }

        resolve();
      }, AuthService.AUTH_READY_TIMEOUT_MS);
    });

    return Promise.race([
      authStateReady,
      startupTimeout
    ]);
  }

  async signUp(
    displayName: string,
    email: string,
    password: string
  ): Promise<AuthResult> {
    try {
      const normalizedEmail =
        email.trim().toLowerCase();

      const userCredential: UserCredential =
        await createUserWithEmailAndPassword(
          firebaseAuth,
          normalizedEmail,
          password
        );

      await updateProfile(
        userCredential.user,
        {
          displayName:
            displayName.trim()
        }
      );

      /*
       * Firebase does not always immediately emit profile changes
       * after updateProfile(), so update our local state explicitly.
       */
      this.currentUserSubject.next(
        userCredential.user
      );

      return {
        success: true,
        user: userCredential.user
      };
    } catch (error: unknown) {
      return {
        success: false,
        errorMessage:
          this.getFriendlyErrorMessage(error)
      };
    }
  }

  async login(
    email: string,
    password: string
  ): Promise<AuthResult> {
    try {
      const normalizedEmail =
        email.trim().toLowerCase();

      const userCredential: UserCredential =
        await this.withRequestTimeout(
          signInWithEmailAndPassword(
            firebaseAuth,
            normalizedEmail,
            password
          )
        );

      // Route guards should not have to wait for the auth listener to
      // publish a user that this request has already authenticated.
      this.currentUserSubject.next(
        userCredential.user
      );

      return {
        success: true,
        user: userCredential.user
      };
    } catch (error: unknown) {
      return {
        success: false,
        errorMessage:
          this.getFriendlyErrorMessage(error)
      };
    }
  }

  async logout(): Promise<AuthResult> {
    try {
      await signOut(firebaseAuth);

      return {
        success: true
      };
    } catch (error: unknown) {
      return {
        success: false,
        errorMessage:
          this.getFriendlyErrorMessage(error)
      };
    }
  }

  async resetPassword(
    email: string
  ): Promise<AuthResult> {
    try {
      const normalizedEmail =
        email.trim().toLowerCase();

      await sendPasswordResetEmail(
        firebaseAuth,
        normalizedEmail
      );

      return {
        success: true
      };
    } catch (error: unknown) {
      return {
        success: false,
        errorMessage:
          this.getFriendlyErrorMessage(error)
      };
    }
  }

  private initializeAuthentication(): void {
    onAuthStateChanged(
      firebaseAuth,
      (user: User | null) => {
        this.currentUserSubject.next(user);
        this.authReadySubject.next(true);
      },
      (error: Error) => {
        console.error(
          'Authentication state error:',
          error
        );

        this.authReadySubject.next(true);
      }
    );
  }

  private getFriendlyErrorMessage(
    error: unknown
  ): string {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error)
    ) {
      return 'Something went wrong. Please try again.';
    }

    const authError =
      error as AuthError;

    if (
      authError.code.startsWith(
        'auth/requests-from-referer-'
      )
    ) {
      return 'Firebase is blocking this app origin. Update the API key restrictions for the iOS app.';
    }

    switch (authError.code) {
      case 'auth/email-already-in-use':
        return 'An account already exists with this email address.';

      case 'auth/invalid-email':
        return 'Please enter a valid email address.';

      case 'auth/weak-password':
        return 'Password must contain at least 6 characters.';

      case 'auth/invalid-credential':
        return 'Incorrect email or password.';

      case 'auth/user-disabled':
        return 'This account has been disabled.';

      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';

      case 'auth/network-request-failed':
        return 'Network error. Check your internet connection.';

      case 'auth/request-timeout':
        return 'Sign in is taking too long. Check your connection and Firebase API key restrictions, then try again.';

      case 'auth/missing-password':
        return 'Please enter your password.';

      case 'auth/operation-not-allowed':
        return 'Email and password authentication is not enabled.';

      case 'auth/unauthorized-domain':
        return 'This app origin is not authorized in Firebase Authentication settings.';

      case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      case 'auth/invalid-api-key':
        return 'The Firebase API key is invalid or blocked by its restrictions.';

      default:
        console.error(
          'Firebase Authentication error:',
          authError
        );

        return 'Authentication failed. Please try again.';
    }
  }

  private withRequestTimeout<T>(
    request: Promise<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject({
          code: 'auth/request-timeout'
        });
      }, AuthService.AUTH_REQUEST_TIMEOUT_MS);

      request.then(
        (value) => {
          window.clearTimeout(timeoutId);
          resolve(value);
        },
        (error: unknown) => {
          window.clearTimeout(timeoutId);
          reject(error);
        }
      );
    });
  }
}
