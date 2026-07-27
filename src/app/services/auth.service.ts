import {
  Injectable
} from '@angular/core';

import {
  BehaviorSubject,
  Observable
} from 'rxjs';

import {
  AuthError,
  User,
  UserCredential,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
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
        await signInWithEmailAndPassword(
          firebaseAuth,
          normalizedEmail,
          password
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
    setPersistence(
      firebaseAuth,
      browserLocalPersistence
    ).catch((error: unknown) => {
      console.error(
        'Unable to configure authentication persistence:',
        error
      );
    });

    onAuthStateChanged(
      firebaseAuth,
      (user: User | null) => {
        this.currentUserSubject.next(user);
        this.authReadySubject.next(true);

        if (user) {
          console.log(
            'Authenticated user:',
            user.email
          );
        } else {
          console.log(
            'No authenticated user'
          );
        }
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

      case 'auth/missing-password':
        return 'Please enter your password.';

      case 'auth/operation-not-allowed':
        return 'Email and password authentication is not enabled.';

      default:
        console.error(
          'Firebase Authentication error:',
          authError
        );

        return 'Authentication failed. Please try again.';
    }
  }
}