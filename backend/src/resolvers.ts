import { GraphQLError } from 'graphql';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { finished } from 'stream/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import User from './models/User';
import Patent from './models/Patent';
import { IUser } from './models/User';
import { IPatent } from './models/Patent';
import { PatentAIService } from './ai/services/patentAIService';

// Define Upload scalar type for GraphQL
const GraphQLUpload = 'Upload';

interface Context {
  user?: {
    id: string;
  };
}

interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => NodeJS.ReadableStream;
}

interface SearchInput {
  query?: string;
  technicalField?: string;
  dateRange?: {
    from?: string;
    to?: string;
  };
  jurisdictions?: string[];
  status?: string[];
  sortBy?: string;
  page?: number;
  limit?: number;
}

// Omit the files field from IPatent and add our own version
type PatentInputBase = Omit<IPatent, 'owner' | '_id' | 'createdAt' | 'updatedAt' | 'files'>;

interface PatentInput extends PatentInputBase {
  files?: Promise<FileUpload>[];
}

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const generateToken = (userId: string): string => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '7d' }
  );
};

const handleFileUpload = async (file: Promise<FileUpload>): Promise<string> => {
  try {
    const { createReadStream, filename } = await file;
    const uniqueFilename = `${uuidv4()}-${filename}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFilename);
    
    const stream = createReadStream();
    const out = fs.createWriteStream(filePath);
    stream.pipe(out);
    await finished(out);

    return uniqueFilename;
  } catch (error) {
    console.error('File upload error:', error);
    throw new GraphQLError('File upload failed', {
      extensions: { code: 'UPLOAD_ERROR' },
    });
  }
};

const resolvers = {
  Upload: GraphQLUpload,

  Query: {
    me: async (_: any, __: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await User.findById(context.user.id);
    },

    getUserPatents: async (_: any, __: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await Patent.find({ owner: context.user.id }).populate('owner');
    },

    getPatent: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const patent = await Patent.findOne({
        _id: id,
        owner: context.user.id,
      }).populate('owner');

      if (!patent) {
        throw new GraphQLError('Patent not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return patent;
    },

    searchPatents: async (_: any, { input }: { input: SearchInput }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const {
        query,
        technicalField,
        dateRange,
        jurisdictions,
        status,
        sortBy = 'createdAt',
        page = 1,
        limit = 10
      } = input;

      const filter: any = { owner: context.user.id };

      if (query) {
        filter.$text = { $search: query };
      }

      if (technicalField) {
        filter.technicalField = technicalField;
      }

      if (dateRange) {
        filter.createdAt = {};
        if (dateRange.from) {
          filter.createdAt.$gte = new Date(dateRange.from);
        }
        if (dateRange.to) {
          filter.createdAt.$lte = new Date(dateRange.to);
        }
      }

      if (jurisdictions?.length) {
        filter.jurisdictions = { $in: jurisdictions };
      }

      if (status?.length) {
        filter.status = { $in: status };
      }

      const totalCount = await Patent.countDocuments(filter);
      const totalPages = Math.ceil(totalCount / limit);

      const patents = await Patent.find(filter)
        .sort({ [sortBy]: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('owner');

      return {
        patents,
        totalCount,
        page,
        totalPages,
      };
    },

    getSimilarPatents: async (_: any, { patentId }: { patentId: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const patent = await Patent.findById(patentId);
      if (!patent) {
        throw new GraphQLError('Patent not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const similarPatents = await Patent.find({
        $text: {
          $search: `${patent.title} ${patent.description}`,
        },
        _id: { $ne: patentId },
        owner: context.user.id
      })
        .limit(5)
        .populate('owner');

      const similarityResults = await Promise.all(
        similarPatents.map(async (similarPatent) => {
          const similarity = await PatentAIService.analyzeSimilarity(
            {
              title: patent.title,
              description: patent.description,
              claims: patent.claims || []
            },
            {
              title: similarPatent.title,
              description: similarPatent.description,
              claims: similarPatent.claims || []
            }
          );
          return {
            ...similarPatent.toObject(),
            similarityScore: similarity.overallSimilarity,
            analysis: similarity.detailedAnalysis
          };
        })
      );

      return similarityResults;
    },

    getAIAnalysis: async (_: any, { patentId }: { patentId: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const patent = await Patent.findById(patentId);
      if (!patent) {
        throw new GraphQLError('Patent not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const analysis = await PatentAIService.analyzePatent(
        patent.title,
        patent.description,
        patent.claims || []
      );

      return {
        technicalComplexity: analysis.gptAnalysis.technicalComplexity,
        marketSizeEstimate: analysis.gptAnalysis.marketPotential * 1000000,
        competitiveLandscape: analysis.gptAnalysis.analysis.opportunities,
        innovationScore: analysis.gptAnalysis.innovationScore,
        riskFactors: analysis.gptAnalysis.analysis.risks,
        technicalClassification: analysis.technicalClassification,
        keyFeatures: analysis.keyFeatures,
        technicalSummary: analysis.technicalSummary
      };
    }
  },

  Mutation: {
    register: async (
      _: any,
      { input }: { input: Omit<IUser, 'role' | 'comparePassword'> }
    ) => {
      const existingUser = await User.findOne({ email: input.email });
      if (existingUser) {
        throw new GraphQLError('Email already exists', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const user = await User.create(input);
      const token = generateToken(user.id);

      return {
        token,
        user,
      };
    },

    login: async (_: any, { input }: { input: Pick<IUser, 'email' | 'password'> }) => {
      const user = await User.findOne({ email: input.email }).select('+password');
      if (!user || !(await user.comparePassword(input.password))) {
        throw new GraphQLError('Invalid email or password', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const token = generateToken(user.id);
      user.password = undefined as any;
      
      return {
        token,
        user,
      };
    },

    createPatent: async (_: any, { input }: { input: PatentInput }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { files, ...patentData } = input;
      const uploadedFiles = files 
        ? await Promise.all(files.map(handleFileUpload))
        : [];

      const patent = await Patent.create({
        ...patentData,
        owner: context.user.id,
        status: 'draft',
        files: uploadedFiles
      });

      return patent.populate('owner');
    },

    updatePatent: async (
      _: any,
      { id, input }: { id: string; input: PatentInput },
      context: Context
    ) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { files, ...updateData } = input;
      const uploadedFiles = files?.length 
        ? await Promise.all(files.map(handleFileUpload)) 
        : [];

      const patent = await Patent.findOneAndUpdate(
        { _id: id, owner: context.user.id },
        {
          ...updateData,
          ...(uploadedFiles.length > 0 && { files: uploadedFiles }),
          updatedAt: new Date()
        },
        { new: true }
      ).populate('owner');

      if (!patent) {
        throw new GraphQLError('Patent not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return patent;
    },

    deletePatent: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const patent = await Patent.findOneAndDelete({
        _id: id,
        owner: context.user.id,
      });

      if (!patent) {
        throw new GraphQLError('Patent not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Clean up uploaded files
      const files = patent.get('files') as string[] | undefined;
      if (files?.length) {
        files.forEach((filename: string) => {
          const filePath = path.join(UPLOAD_DIR, filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      }

      // Clean up documents if they exist
      const documents = patent.get('documents') as Array<{ url: string }> | undefined;
      if (documents?.length) {
        documents.forEach(doc => {
          const filePath = path.join(UPLOAD_DIR, doc.url);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      }

      return true;
    },

    updatePatentStatus: async (
      _: any,
      { id, status }: { id: string; status: string },
      context: Context
    ) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const patent = await Patent.findOneAndUpdate(
        { _id: id, owner: context.user.id },
        { status },
        { new: true }
      ).populate('owner');

      if (!patent) {
        throw new GraphQLError('Patent not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return patent;
    },

    uploadDocument: async (_: any, { input }: { input: any }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { patentId, name, type, file } = input;

      const patent = await Patent.findOne({
        _id: patentId,
        owner: context.user.id,
      });

      if (!patent) {
        throw new GraphQLError('Patent not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const { createReadStream, filename } = await file;
      const stream = createReadStream();
      const uniqueFilename = `${uuidv4()}-${filename}`;
      const uploadDir = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploadDir, uniqueFilename);

      // Ensure upload directory exists
      await fs.promises.mkdir(uploadDir, { recursive: true });

      // Save file
      const out = fs.createWriteStream(filePath);
      await finished(stream.pipe(out));

      const document = {
        id: uuidv4(),
        name,
        url: `/uploads/${uniqueFilename}`,
        type,
        uploadedAt: new Date().toISOString(),
      };

      // Add document to patent
      if (!patent.documents) {
        patent.documents = [];
      }
      patent.documents.push(document);
      await patent.save();

      return document;
    },

    deleteDocument: async (_: any, { documentId }: { documentId: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const patent = await Patent.findOne({
        'documents.id': documentId,
        owner: context.user.id,
      });

      if (!patent) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const document = patent.documents.find(doc => doc.id === documentId);
      if (document) {
        // Delete file from filesystem
        const filePath = path.join(process.cwd(), document.url);
        try {
          await fs.promises.unlink(filePath);
        } catch (error) {
          console.error('Error deleting file:', error);
        }
      }

      // Remove document from patent
      patent.documents = patent.documents.filter(doc => doc.id !== documentId);
      await patent.save();

      return true;
    },

    generateSearchReport: async (_: any, { patentId }: { patentId: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const patent = await Patent.findOne({
        _id: patentId,
        owner: context.user.id,
      });

      if (!patent) {
        throw new GraphQLError('Patent not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Mock search report generation - replace with actual implementation
      return {
        similarityScore: Math.random() * 100,
        priorArtReferences: [
          {
            patentNumber: 'US123456789',
            title: 'Similar Technology Patent',
            relevanceScore: Math.random() * 100,
            matchingClaims: ['Claim 1', 'Claim 3'],
            publicationDate: new Date().toISOString()
          }
        ],
        aiAnalysis: {
          technicalComplexity: Math.random() * 100,
          marketSizeEstimate: Math.random() * 1000000000,
          competitiveLandscape: ['High competition', 'Growing market'],
          innovationScore: Math.random() * 100,
          riskFactors: ['Similar patents exist', 'Complex technology']
        },
        recommendations: [
          'Consider modifying claim 1 to differentiate from prior art',
          'Focus on unique technical aspects in claims 3-5',
          'Explore alternative jurisdictions for filing'
        ]
      };
    }
  }
};

export default resolvers; 