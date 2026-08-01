export type ActivityType =
  | 'feeding'
  | 'solids'
  | 'sleep'
  | 'diaper';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  value: string;
  time: string;
  createdAt: number;
  createdByUid?: string;
  createdByName?: string;
  photoId?: string;
  /** Legacy inline attachment retained for existing records. */
  photoDataUrl?: string;
}
