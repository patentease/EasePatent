import { Plan } from './auth.types';

export type SubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'PENDING' | 'EXPIRED';

export interface SubscriptionPlan {
  id: string;
  name: Plan;
  features: {
    patentChecks: number; // -1 for unlimited
    blockchainTimestamps: number;
    consultationMinutes: number;
    apiAccess: boolean;
    advancedAnalytics: boolean;
    teamCollaboration: boolean;
    customTemplates: boolean;
    prioritySupport: boolean;
  };
  trialDays: number;
  monthlyPrice: number;
  annualPrice: number;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: Plan;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date | null;
  trialEndsAt: Date | null;
  cancelledAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  paymentMethod?: string;
  autoRenew: boolean;
}

export interface SubscriptionUsage {
  id: string;
  subscriptionId: string;
  period: {
    start: Date;
    end: Date;
  };
  usage: {
    patentChecks: number;
    blockchainTimestamps: number;
    consultationMinutes: number;
  };
}

export interface SubscriptionInvoice {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'PAID' | 'PENDING' | 'FAILED';
  billingPeriod: {
    start: Date;
    end: Date;
  };
  paidAt: Date | null;
  invoiceUrl: string;
} 