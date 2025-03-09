import { v4 as uuidv4 } from 'uuid';
import { Plan } from '../types/auth.types';

class SubscriptionError extends Error {
  code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

// Simple mock implementation that doesn't rely on Prisma
export const subscriptionResolvers = {
  Mutation: {
    createSubscription: async (_: any, { userId, plan }: { userId: string; plan: Plan }) => {
      try {
        // In a real implementation, this would create a subscription in the database
        // For now, we'll just return a mock subscription object
        const subscriptionId = uuidv4();
        const now = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

        return {
          id: subscriptionId,
          userId,
          plan,
          status: 'ACTIVE',
          startDate: now,
          currentPeriodStart: now,
          currentPeriodEnd: endDate,
          autoRenew: true,
          createdAt: now,
          updatedAt: now
        };
      } catch (error) {
        console.error('Error creating subscription:', error);
        throw new SubscriptionError('Failed to create subscription', 'SUBSCRIPTION_CREATION_FAILED');
      }
    }
  }
}; 