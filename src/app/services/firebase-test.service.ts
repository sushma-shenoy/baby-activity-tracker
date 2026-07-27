import {
  Injectable
} from '@angular/core';

import {
  firebaseApp
} from '../firebase/firebase.config';

@Injectable({
  providedIn: 'root'
})
export class FirebaseTestService {
  verifyConnection(): void {
    console.log(
      'Firebase connected:',
      firebaseApp.name
    );

    console.log(
      'Firebase project:',
      firebaseApp.options.projectId
    );
  }
}