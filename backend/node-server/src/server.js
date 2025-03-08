import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import typeDefs from './graphql/schema.js';
import resolvers from './graphql/resolvers/index.js';
import { connectDB } from './config/database.js';
import { auth } from './middleware/auth.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(auth);

// Connect to databases
connectDB();

// Apollo Server setup
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => ({ req }),
  csrfPrevention: true,
  cache: 'bounded'
});

async function startServer() {
  await server.start();
  
  server.applyMiddleware({ 
    app,
    cors: false // We're handling CORS with the express middleware
  });

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🚀 GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
  });
}

startServer(); 