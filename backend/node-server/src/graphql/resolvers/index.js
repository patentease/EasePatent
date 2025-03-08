import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import Patent from '../../models/Patent.js';
import AIAnalysis from '../../models/AIAnalysis.js';
import BlockchainRecord from '../../models/BlockchainRecord.js';
import { AuthenticationError, UserInputError } from 'apollo-server-express';

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const resolvers = {
  Query: {
    getUser: async (_, { id }, context) => {
      if (!context.req.user) throw new AuthenticationError('Not authenticated');
      return await User.findById(id);
    },
    getPatent: async (_, { id }, context) => {
      if (!context.req.user) throw new AuthenticationError('Not authenticated');
      return await Patent.findById(id).populate('owner');
    },
    searchPatents: async (_, { query }, context) => {
      if (!context.req.user) throw new AuthenticationError('Not authenticated');
      return await Patent.find(
        { $text: { $search: query } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .populate('owner');
    },
    getUserPatents: async (_, __, context) => {
      if (!context.req.user) throw new AuthenticationError('Not authenticated');
      return await Patent.find({ owner: context.req.user.id }).populate('owner');
    },
    getAIAnalysis: async (_, { patentId }, context) => {
      if (!context.req.user) throw new AuthenticationError('Not authenticated');
      return await AIAnalysis.findOne({ patentId });
    },
    getBlockchainRecord: async (_, { patentId }, context) => {
      if (!context.req.user) throw new AuthenticationError('Not authenticated');
      return await BlockchainRecord.findOne({ patentId });
    }
  },

  Mutation: {
    register: async (_, { email, password, name, organization }) => {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new UserInputError('Email already registered');
      }

      const user = await User.create({
        email,
        password,
        name,
        organization
      });

      const token = generateToken(user);
      return { token, user };
    },

    login: async (_, { email, password }) => {
      const user = await User.findOne({ email });
      if (!user) {
        throw new UserInputError('Invalid credentials');
      }

      const isValid = await user.comparePassword(password);
      if (!isValid) {
        throw new UserInputError('Invalid credentials');
      }

      const token = generateToken(user);
      return { token, user };
    },

    createPatent: async (_, { input }, context) => {
      if (!context.req.user) throw new AuthenticationError('Not authenticated');
      
      const patent = await Patent.create({
        ...input,
        owner: context.req.user.id
      });

      return await patent.populate('owner');
    },

    updatePatent: async (_, { id, input }, context) => {
      if (!context.req.user) throw new AuthenticationError('Not authenticated');

      const patent = await Patent.findById(id);
      if (!patent) throw new UserInputError('Patent not found');
      if (patent.owner.toString() !== context.req.user.id) {
        throw new AuthenticationError('Not authorized');
      }

      const updatedPatent = await Patent.findByIdAndUpdate(
        id,
        { ...input },
        { new: true }
      ).populate('owner');

      return updatedPatent;
    },

    deletePatent: async (_, { id }, context) => {
      if (!context.req.user) throw new AuthenticationError('Not authenticated');

      const patent = await Patent.findById(id);
      if (!patent) throw new UserInputError('Patent not found');
      if (patent.owner.toString() !== context.req.user.id) {
        throw new AuthenticationError('Not authorized');
      }

      await Patent.findByIdAndDelete(id);
      return true;
    },

    generateAIAnalysis: async (_, { patentId }, context) => {
      if (!context.req.user) throw new AuthenticationError('Not authenticated');

      const patent = await Patent.findById(patentId);
      if (!patent) throw new UserInputError('Patent not found');

      // Here you would integrate with your AI services (BERT, GPT-4)
      // This is a placeholder for the actual AI analysis
      const analysis = await AIAnalysis.create({
        patentId,
        similarityScore: 85,
        priorArtReferences: [],
        aiSuggestions: "Placeholder for AI suggestions"
      });

      return analysis;
    },

    createBlockchainRecord: async (_, { patentId }, context) => {
      if (!context.req.user) throw new AuthenticationError('Not authenticated');

      const patent = await Patent.findById(patentId);
      if (!patent) throw new UserInputError('Patent not found');

      // Here you would integrate with Ethereum/Solana
      // This is a placeholder for the actual blockchain integration
      const record = await BlockchainRecord.create({
        patentId,
        transactionHash: "0x...",
        network: "ethereum",
        ipfsHash: "Qm...",
        smartContractAddress: "0x...",
        ownerAddress: "0x..."
      });

      return record;
    }
  }
};

export default resolvers; 