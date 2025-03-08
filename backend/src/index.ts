import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import connectDB from './config/database';
import typeDefs from './schema';
import resolvers from './resolvers';
import { GraphQLError } from 'graphql';
import jwt from 'jsonwebtoken';
import { IUser } from './models/User';

dotenv.config();

interface MyContext {
  user?: IUser;
}

const app = express();
const httpServer = http.createServer(app);

// Connect to MongoDB
connectDB();

const server = new ApolloServer<MyContext>({
  typeDefs,
  resolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});

const startServer = async () => {
  await server.start();

  app.use(
    '/',
    cors<cors.CorsRequest>({
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true
    }),
    bodyParser.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        // Get the user token from the headers
        const token = req.headers.authorization || '';

        // Try to retrieve a user with the token
        if (token) {
          try {
            const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET as string) as { id: string };
            // Add the user to the context
            return { user: decoded };
          } catch (error) {
            throw new GraphQLError('Invalid/Expired token', {
              extensions: {
                code: 'UNAUTHENTICATED',
                http: { status: 401 },
              },
            });
          }
        }

        // Add the user to the context
        return { user: undefined };
      },
    })
  );

  const port = process.env.PORT || 4000;
  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));
  console.log(`🚀 Server ready at http://localhost:${port}/`);
};

startServer().catch((err) => {
  console.error('Error starting server:', err);
}); 