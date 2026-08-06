import { Injectable } from '@angular/core';
import {
  Bytes,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { firebaseApp, firebaseAuth } from '../firebase/firebase.config';
import { trackerStorage } from '../firebase/tracker-storage';

export type PhotoCategory = 'diaper' | 'profile';

@Injectable({
  providedIn: 'root'
})
export class PhotoStorageService {
  private readonly firestore = getFirestore(firebaseApp);
  private readonly photoUrls = new Map<string, string>();

  async savePhoto(
    photoId: string,
    file: File,
    category: PhotoCategory
  ): Promise<void> {
    trackerStorage.requireEditAccess();
    const user = firebaseAuth.currentUser;

    if (!user) {
      throw new Error('Sign in before uploading a photo.');
    }

    const image = await this.compressPhoto(file, category);

    await setDoc(
      doc(
        this.firestore,
        'users',
        trackerStorage.currentDataOwnerId,
        'photos',
        photoId
      ),
      {
        imageBytes: Bytes.fromUint8Array(
          new Uint8Array(await image.arrayBuffer())
        ),
        contentType: image.type,
        category,
        profileId: localStorage.getItem('baby_tracker_device_active_profile_id') || '',
        updatedAt: serverTimestamp()
      }
    );

    this.clearCachedPhoto(photoId);
  }

  async getPhotoUrl(photoId?: string): Promise<string> {
    if (!photoId) {
      return '';
    }

    const cachedUrl = this.photoUrls.get(photoId);
    if (cachedUrl) {
      return cachedUrl;
    }

    const user = firebaseAuth.currentUser;
    if (!user) {
      return '';
    }

    const snapshot = await getDoc(
      doc(
        this.firestore,
        'users',
        trackerStorage.currentDataOwnerId,
        'photos',
        photoId
      )
    );

    if (!snapshot.exists()) {
      return '';
    }

    const data = snapshot.data();
    if (
      !(data['imageBytes'] instanceof Bytes) ||
      typeof data['contentType'] !== 'string'
    ) {
      return '';
    }

    const storedBytes =
      data['imageBytes'].toUint8Array();
    const imageBytes =
      new Uint8Array(storedBytes.length);
    imageBytes.set(storedBytes);

    const url = URL.createObjectURL(
      new Blob(
        [imageBytes.buffer],
        { type: data['contentType'] }
      )
    );

    this.photoUrls.set(photoId, url);
    return url;
  }

  async deletePhoto(photoId?: string): Promise<void> {
    if (!photoId) {
      return;
    }

    trackerStorage.requireEditAccess();

    const user = firebaseAuth.currentUser;
    if (!user) {
      return;
    }

    await deleteDoc(
      doc(
        this.firestore,
        'users',
        trackerStorage.currentDataOwnerId,
        'photos',
        photoId
      )
    );
    this.clearCachedPhoto(photoId);
  }

  async deletePhotosForProfile(profileId: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user || !profileId) return;
    const snapshot = await getDocs(query(
      collection(this.firestore, 'users', trackerStorage.currentDataOwnerId, 'photos'),
      where('profileId', '==', profileId)
    ));
    for (let index = 0; index < snapshot.docs.length; index += 400) {
      const batch = writeBatch(this.firestore);
      snapshot.docs.slice(index, index + 400).forEach(item => batch.delete(item.ref));
      await batch.commit();
    }
    snapshot.docs.forEach(item => this.clearCachedPhoto(item.id));
  }

  private async compressPhoto(
    file: File,
    category: PhotoCategory
  ): Promise<Blob> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Choose an image file.');
    }

    const image = await this.loadImage(file);
    const maximumDimension = category === 'profile' ? 512 : 1280;
    const maximumBytes = category === 'profile'
      ? 150 * 1024
      : 300 * 1024;
    const scale = Math.min(
      1,
      maximumDimension / Math.max(image.width, image.height)
    );
    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d')?.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );

    for (
      let quality = 0.82;
      quality >= 0.42;
      quality -= 0.1
    ) {
      const result = await this.canvasToBlob(canvas, quality);
      if (result.size <= maximumBytes) {
        return result;
      }
    }

    throw new Error('The photo could not be compressed enough.');
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const source = URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(source);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(source);
        reject(new Error('Unable to read image.'));
      };
      image.src = source;
    });
  }

  private canvasToBlob(
    canvas: HTMLCanvasElement,
    quality: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob
          ? resolve(blob)
          : reject(new Error('Unable to compress image.')),
        'image/webp',
        quality
      );
    });
  }

  private clearCachedPhoto(photoId: string): void {
    const cachedUrl = this.photoUrls.get(photoId);
    if (cachedUrl) {
      URL.revokeObjectURL(cachedUrl);
      this.photoUrls.delete(photoId);
    }
  }
}
