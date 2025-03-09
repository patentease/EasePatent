import { ApolloError } from 'apollo-server-express';
import { v4 as uuidv4 } from 'uuid';
import { Plan } from '../types/auth.types';

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
        throw new ApolloError('Failed to create subscription');
      }
    }
  }
}; 