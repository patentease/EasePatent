import { ApolloError } from 'apollo-server-express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { RegisterInput, LoginInput, AuthPayload, User } from '../types/auth.types';
import { subscriptionResolvers } from './subscription.resolver';

export const authResolvers = {
  Query: {
    me: async (_: any, __: any, { user }: { user: any }) => {
      if (!user) {
        throw new ApolloError('Not authenticated', 'NOT_AUTHENTICATED');
      }

      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.userId },
        });

        if (!dbUser) {
          throw new ApolloError('User not found', 'USER_NOT_FOUND');
        }

        // Add plan field to match User interface
        return {
          ...dbUser,
          plan: 'free' // Default to free plan if not specified
        } as User;
      } catch (error) {
        console.error('Error fetching user:', error);
        throw new ApolloError('Failed to fetch user');
      }
    },
  },

  Mutation: {
    register: async (_: any, { input }: { input: RegisterInput }) => {
      try {
        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: input.email },
        });

        if (existingUser) {
          throw new ApolloError('Email already exists', 'EMAIL_EXISTS');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(input.password, 10);

        // Create user
        const user = await prisma.user.create({
          data: {
            email: input.email,
            password: hashedPassword,
            firstName: input.firstName,
            lastName: input.lastName,
            role: 'USER',
          },
        });

        // Create subscription
        await subscriptionResolvers.Mutation.createSubscription(
          null,
          {
            userId: user.id,
            plan: input.plan,
          }
        );

        // Generate JWT token
        const token = jwt.sign(
          { userId: user.id, email: user.email },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '24h' }
        );

        // Add plan field to match User interface
        return {
          token,
          user: {
            ...user,
            plan: input.plan
          } as User,
        };
      } catch (error) {
        console.error('Registration error:', error);
        if (error instanceof ApolloError) {
          throw error;
        }
        throw new ApolloError('Failed to register user');
      }
    },

    login: async (_: any, { input }: { input: LoginInput }): Promise<AuthPayload> => {
      try {
        const user = await prisma.user.findUnique({
          where: { email: input.email },
        });

        if (!user) {
          throw new ApolloError('Invalid email or password', 'INVALID_CREDENTIALS');
        }

        const validPassword = await bcrypt.compare(input.password, user.password);

        if (!validPassword) {
          throw new ApolloError('Invalid email or password', 'INVALID_CREDENTIALS');
        }

        const token = jwt.sign(
          { userId: user.id, email: user.email },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '24h' }
        );

        // Get user's subscription to determine plan
        const subscription = await prisma.subscription.findFirst({
          where: { userId: user.id, status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' }
        });

        // Add plan field to match User interface
        return {
          token,
          user: {
            ...user,
            plan: subscription?.plan || 'free'
          } as User,
        };
      } catch (error) {
        console.error('Login error:', error);
        if (error instanceof ApolloError) {
          throw error;
        }
        throw new ApolloError('Failed to login');
      }
    },
  },
}; 