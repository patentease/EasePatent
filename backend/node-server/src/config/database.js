import mongoose from 'mongoose';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// MongoDB Connection
export const connectDB = async () => {
  try {
    const mongoConn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/easepatent');
    console.log('MongoDB Connected');
    return mongoConn;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// PostgreSQL Connection
export const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  username: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DATABASE || 'easepatent',
  logging: false
});

export const connectPostgres = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL Connected');
  } catch (err) {
    console.error('PostgreSQL connection error:', err);
    process.exit(1);
  }
}; 