import jwt from 'jsonwebtoken';
import { AuthenticationError } from 'apollo-server-express';

export const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

export const requireAuth = (resolver) => {
  return (parent, args, context, info) => {
    if (!context.req.user) {
      throw new AuthenticationError('Not authenticated');
    }
    return resolver(parent, args, context, info);
  };
}; 