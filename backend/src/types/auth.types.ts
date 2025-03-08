export type Plan = 'free' | 'pro';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  plan: Plan;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  plan: Plan;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthPayload {
  token: string;
  user: User;
}

export interface UserSettings {
  userId: string;
  emailNotifications: boolean;
  theme: 'light' | 'dark';
  language: string;
}

export interface UserQuota {
  userId: string;
  patentChecksRemaining: number;
  blockchainTimestampsRemaining: number;
  consultationMinutesRemaining: number;
}

export interface Subscription {
  userId: string;
  plan: Plan;
  status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED';
  startDate: Date;
  endDate: Date | null;
} 