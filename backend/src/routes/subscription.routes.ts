import { Router } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Create subscription
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: {
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        }
      });
    }

    // Create subscription
    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

    const subscription = await prisma.subscription.create({
      data: {
        id: uuidv4(),
        userId,
        plan,
        status: 'ACTIVE',
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: endDate,
        autoRenew: true
      }
    });

    res.json(subscription);
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create subscription',
        code: 'SUBSCRIPTION_CREATION_FAILED'
      }
    });
  }
});

// Get user's active subscription
router.get('/active', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: {
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        }
      });
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!subscription) {
      return res.status(404).json({
        error: {
          message: 'No active subscription found',
          code: 'NO_ACTIVE_SUBSCRIPTION'
        }
      });
    }

    res.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch subscription',
        code: 'FETCH_SUBSCRIPTION_FAILED'
      }
    });
  }
});

// Cancel subscription
router.post('/cancel', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: {
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        }
      });
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!subscription) {
      return res.status(404).json({
        error: {
          message: 'No active subscription found',
          code: 'NO_ACTIVE_SUBSCRIPTION'
        }
      });
    }

    // Update subscription status
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        autoRenew: false
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      error: {
        message: 'Failed to cancel subscription',
        code: 'SUBSCRIPTION_CANCELLATION_FAILED'
      }
    });
  }
});

export const subscriptionRouter = router; 