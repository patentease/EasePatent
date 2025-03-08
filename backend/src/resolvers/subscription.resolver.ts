import { ApolloError } from 'apollo-server-express';
import { prisma } from '../db';
import { Subscription, SubscriptionStatus } from '../types/subscription.types';
import { Plan } from '../types/auth.types';

export const subscriptionResolvers = {
  Query: {
    getUserSubscription: async (_: any, { userId }: { userId: string }) => {
      try {
        const subscription = await prisma.subscription.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });

        if (!subscription) {
          throw new ApolloError('No subscription found', 'SUBSCRIPTION_NOT_FOUND');
        }

        return subscription;
      } catch (error) {
        console.error('Error fetching subscription:', error);
        throw new ApolloError('Failed to fetch subscription');
      }
    },

    getSubscriptionUsage: async (_: any, { subscriptionId }: { subscriptionId: string }) => {
      try {
        const usage = await prisma.subscriptionUsage.findFirst({
          where: { subscriptionId },
          orderBy: { period: { start: 'desc' } },
        });

        if (!usage) {
          throw new ApolloError('No usage data found', 'USAGE_NOT_FOUND');
        }

        return usage;
      } catch (error) {
        console.error('Error fetching usage:', error);
        throw new ApolloError('Failed to fetch subscription usage');
      }
    },
  },

  Mutation: {
    createSubscription: async (
      _: any,
      { 
        userId, 
        plan,
        paymentMethod 
      }: { 
        userId: string; 
        plan: Plan;
        paymentMethod?: string;
      }
    ) => {
      try {
        // Check for existing active subscription
        const existingSubscription = await prisma.subscription.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
          },
        });

        if (existingSubscription) {
          throw new ApolloError('User already has an active subscription', 'SUBSCRIPTION_EXISTS');
        }

        // Get plan details
        const planDetails = await prisma.subscriptionPlan.findFirst({
          where: { name: plan },
        });

        if (!planDetails) {
          throw new ApolloError('Invalid plan selected', 'INVALID_PLAN');
        }

        // Create new subscription
        const now = new Date();
        const subscription = await prisma.subscription.create({
          data: {
            userId,
            plan,
            status: 'ACTIVE',
            startDate: now,
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
            trialEndsAt: planDetails.trialDays ? new Date(now.getTime() + planDetails.trialDays * 24 * 60 * 60 * 1000) : null,
            autoRenew: true,
            paymentMethod,
          },
        });

        // Initialize usage tracking
        await prisma.subscriptionUsage.create({
          data: {
            subscriptionId: subscription.id,
            period: {
              start: now,
              end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
            usage: {
              patentChecks: 0,
              blockchainTimestamps: 0,
              consultationMinutes: 0,
            },
          },
        });

        return subscription;
      } catch (error) {
        console.error('Error creating subscription:', error);
        throw new ApolloError('Failed to create subscription');
      }
    },

    updateSubscriptionStatus: async (
      _: any,
      { 
        subscriptionId, 
        status 
      }: { 
        subscriptionId: string; 
        status: SubscriptionStatus;
      }
    ) => {
      try {
        const subscription = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status,
            cancelledAt: status === 'CANCELLED' ? new Date() : undefined,
          },
        });

        return subscription;
      } catch (error) {
        console.error('Error updating subscription:', error);
        throw new ApolloError('Failed to update subscription status');
      }
    },

    updateSubscriptionPlan: async (
      _: any,
      { 
        subscriptionId, 
        newPlan 
      }: { 
        subscriptionId: string; 
        newPlan: Plan;
      }
    ) => {
      try {
        const subscription = await prisma.subscription.findUnique({
          where: { id: subscriptionId },
        });

        if (!subscription) {
          throw new ApolloError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
        }

        // Handle plan upgrade/downgrade logic
        const now = new Date();
        const updatedSubscription = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            plan: newPlan,
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        // Reset usage for new period
        await prisma.subscriptionUsage.create({
          data: {
            subscriptionId,
            period: {
              start: now,
              end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
            usage: {
              patentChecks: 0,
              blockchainTimestamps: 0,
              consultationMinutes: 0,
            },
          },
        });

        return updatedSubscription;
      } catch (error) {
        console.error('Error updating subscription plan:', error);
        throw new ApolloError('Failed to update subscription plan');
      }
    },

    recordUsage: async (
      _: any,
      { 
        subscriptionId, 
        usageType, 
        amount 
      }: { 
        subscriptionId: string; 
        usageType: 'patentChecks' | 'blockchainTimestamps' | 'consultationMinutes'; 
        amount: number;
      }
    ) => {
      try {
        const currentUsage = await prisma.subscriptionUsage.findFirst({
          where: {
            subscriptionId,
            period: {
              end: {
                gte: new Date(),
              },
            },
          },
        });

        if (!currentUsage) {
          throw new ApolloError('No active usage period found', 'USAGE_PERIOD_NOT_FOUND');
        }

        const updatedUsage = await prisma.subscriptionUsage.update({
          where: { id: currentUsage.id },
          data: {
            usage: {
              ...currentUsage.usage,
              [usageType]: currentUsage.usage[usageType] + amount,
            },
          },
        });

        return updatedUsage;
      } catch (error) {
        console.error('Error recording usage:', error);
        throw new ApolloError('Failed to record usage');
      }
    },
  },
}; 