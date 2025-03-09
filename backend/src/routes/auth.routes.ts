import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';
import { authenticateToken } from '../middleware/auth';
import { subscriptionResolvers } from '../resolvers/subscription.resolver';

class AuthError extends Error {
  code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

const router = Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, plan } = req.body;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new AuthError('Email already exists', 'EMAIL_EXISTS');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'USER'
      }
    });

    // Create subscription
    await subscriptionResolvers.Mutation.createSubscription(
      null,
      {
        userId: user.id,
        plan: plan || 'free'
      }
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        ...user,
        plan: plan || 'free'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof AuthError) {
      res.status(400).json({
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
      res.status(500).json({
        error: {
          message: 'Failed to register user',
          code: 'REGISTRATION_FAILED'
        }
      });
    }
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Get user's subscription
    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      token,
      user: {
        ...user,
        plan: subscription?.plan || 'free'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof AuthError) {
      res.status(401).json({
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
      res.status(500).json({
        error: {
          message: 'Failed to login',
          code: 'LOGIN_FAILED'
        }
      });
    }
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user?.userId }
    });

    if (!dbUser) {
      throw new AuthError('User not found', 'USER_NOT_FOUND');
    }

    // Get user's subscription
    const subscription = await prisma.subscription.findFirst({
      where: { userId: dbUser.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      ...dbUser,
      plan: subscription?.plan || 'free'
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    if (error instanceof AuthError) {
      res.status(404).json({
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
      res.status(500).json({
        error: {
          message: 'Failed to fetch user',
          code: 'FETCH_USER_FAILED'
        }
      });
    }
  }
});

export const authRouter = router; 