import {
  User
} from 'firebase/auth';

export interface AuthResult {
  success: boolean;
  user?: User;
  errorMessage?: string;
  verificationEmailSent?: boolean;
}
