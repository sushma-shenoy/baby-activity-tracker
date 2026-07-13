export type ActivityType = 'feeding' | 'sleep' | 'diaper';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  value: string;
  time: string;
  createdAt: number;
}