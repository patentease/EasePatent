import { ApolloError } from 'apollo-server-express';
import { prisma } from '../db';
import { BERTService } from '../ai/services/bertService';
import { GPT4Service } from '../ai/services/gpt4Service';
import { PatentAIService } from '../ai/services/patentAIService';
import { createWriteStream } from 'fs';
import { finished } from 'stream/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Define types
interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => NodeJS.ReadableStream;
}

interface PatentInput {
  title: string;
  description: string;
  inventors: string[];
  jurisdictions: string[];
  technicalField?: string;
  backgroundArt?: string;
  claims?: string[];
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

interface DocumentUploadInput {
  patentId: string;
  name: string;
  type: string;
  file: Promise<FileUpload>;
}

export const patentResolvers = {
  Query: {
    getUserPatents: async (_: any, __: any, { user }: { user: any }) => {
      if (!user) {
        throw new ApolloError('Not authenticated', 'NOT_AUTHENTICATED');
      }

      try {
        // Make sure the Prisma schema has Patent model defined
        const patentsResult = await prisma.$queryRaw`
          SELECT p.*, u.email as owner_email, u.firstName as owner_firstName, u.lastName as owner_lastName
          FROM "Patent" p
          JOIN "User" u ON p."ownerId" = u.id
          WHERE p."ownerId" = ${user.userId}
        `;

        return patentsResult as any[];
      } catch (error) {
        console.error('Error fetching user patents:', error);
        throw new ApolloError('Failed to fetch patents');
      }
    },

    getPatent: async (_: any, { id }: { id: string }, { user }: { user: any }) => {
      if (!user) {
        throw new ApolloError('Not authenticated', 'NOT_AUTHENTICATED');
      }

      try {
        // Use raw query instead of Prisma client methods
        const patentsResult = await prisma.$queryRaw`
          SELECT p.*, u.email as owner_email, u.firstName as owner_firstName, u.lastName as owner_lastName
          FROM "Patent" p
          JOIN "User" u ON p."ownerId" = u.id
          WHERE p.id = ${id}
        `;

        const patents = patentsResult as any[];
        const patent = patents[0];

        if (!patent) {
          throw new ApolloError('Patent not found', 'PATENT_NOT_FOUND');
        }

        // Check if user is the owner
        if (patent.ownerId !== user.userId) {
          throw new ApolloError('Not authorized to view this patent', 'NOT_AUTHORIZED');
        }

        // Get documents for this patent
        const documentsResult = await prisma.$queryRaw`
          SELECT * FROM "Document"
          WHERE "patentId" = ${id}
        `;

        return {
          ...patent,
          documents: documentsResult as any[]
        };
      } catch (error) {
        console.error('Error fetching patent:', error);
        if (error instanceof ApolloError) {
          throw error;
        }
        throw new ApolloError('Failed to fetch patent');
      }
    },

    searchPatents: async (_: any, { input }: { input: SearchInput }, { user }: { user: any }) => {
      if (!user) {
        throw new ApolloError('Not authenticated', 'NOT_AUTHENTICATED');
      }

      try {
        const {
          query,
          technicalField,
          dateRange,
          jurisdictions,
          status,
          sortBy = 'createdAt_DESC',
          page = 1,
          limit = 10
        } = input;

        // Build SQL query conditions
        let conditions = [`"ownerId" = '${user.userId}'`];

        if (query) {
          conditions.push(`(title ILIKE '%${query}%' OR description ILIKE '%${query}%')`);
        }

        if (technicalField) {
          conditions.push(`"technicalField" ILIKE '%${technicalField}%'`);
        }

        if (jurisdictions && jurisdictions.length > 0) {
          conditions.push(`jurisdictions && ARRAY[${jurisdictions.map(j => `'${j}'`).join(',')}]`);
        }

        if (status && status.length > 0) {
          conditions.push(`status IN (${status.map(s => `'${s}'`).join(',')})`);
        }

        if (dateRange) {
          if (dateRange.from) {
            conditions.push(`"createdAt" >= '${dateRange.from}'`);
          }
          if (dateRange.to) {
            conditions.push(`"createdAt" <= '${dateRange.to}'`);
          }
        }

        // Parse sort option
        const [sortField, sortOrder] = sortBy.split('_');
        const orderClause = `"${sortField}" ${sortOrder}`;

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Execute query with count
        const countQuery = `
          SELECT COUNT(*) as count
          FROM "Patent"
          WHERE ${conditions.join(' AND ')}
        `;

        const patentsQuery = `
          SELECT p.*, u.email as owner_email, u.firstName as owner_firstName, u.lastName as owner_lastName
          FROM "Patent" p
          JOIN "User" u ON p."ownerId" = u.id
          WHERE ${conditions.join(' AND ')}
          ORDER BY ${orderClause}
          LIMIT ${limit} OFFSET ${skip}
        `;

        const [countResultRaw, patentsResultRaw] = await Promise.all([
          prisma.$queryRaw`${countQuery}`,
          prisma.$queryRaw`${patentsQuery}`
        ]);

        const countResult = countResultRaw as any[];
        const patentsResult = patentsResultRaw as any[];
        
        const totalCount = Number(countResult[0].count);
        const totalPages = Math.ceil(totalCount / limit);

        // Get documents for each patent
        const patentIds = patentsResult.map((p: any) => p.id);
        let documentsResult: any[] = [];
        
        if (patentIds.length > 0) {
          documentsResult = await prisma.$queryRaw`
            SELECT * FROM "Document"
            WHERE "patentId" IN (${patentIds.join(',')})
          ` as any[];
        }

        // Attach documents to patents
        const patentsWithDocuments = patentsResult.map((patent: any) => ({
          ...patent,
          documents: documentsResult.filter((doc: any) => doc.patentId === patent.id)
        }));

        return {
          patents: patentsWithDocuments,
          totalCount,
          page,
          totalPages
        };
      } catch (error) {
        console.error('Error searching patents:', error);
        throw new ApolloError('Failed to search patents');
      }
    },

    getSimilarPatents: async (_: any, { patentId }: { patentId: string }, { user }: { user: any }) => {
      if (!user) {
        throw new ApolloError('Not authenticated', 'NOT_AUTHENTICATED');
      }

      try {
        // Get the source patent
        const patentResult = await prisma.$queryRaw`
          SELECT * FROM "Patent"
          WHERE id = ${patentId}
        `;

        const patents = patentResult as any[];
        const patent = patents[0];

        if (!patent) {
          throw new ApolloError('Patent not found', 'PATENT_NOT_FOUND');
        }

        // Use BERT to find similar patents
        const similarPatents = await BERTService.findSimilarPatents(
          patent.title,
          patent.description,
          patent.claims || []
        );

        // Fetch the actual patent data
        const patentIds = similarPatents.map(p => p.id);
        
        if (patentIds.length === 0) {
          return [];
        }
        
        const similarPatentsResult = await prisma.$queryRaw`
          SELECT p.*, u.email as owner_email, u.firstName as owner_firstName, u.lastName as owner_lastName
          FROM "Patent" p
          JOIN "User" u ON p."ownerId" = u.id
          WHERE p.id IN (${patentIds.join(',')})
        `;

        return similarPatentsResult as any[];
      } catch (error) {
        console.error('Error finding similar patents:', error);
        throw new ApolloError('Failed to find similar patents');
      }
    },

    getAIAnalysis: async (_: any, { patentId }: { patentId: string }, { user }: { user: any }) => {
      if (!user) {
        throw new ApolloError('Not authenticated', 'NOT_AUTHENTICATED');
      }

      try {
        const patentResult = await prisma.$queryRaw`
          SELECT * FROM "Patent"
          WHERE id = ${patentId}
        `;

        const patents = patentResult as any[];
        const patent = patents[0];

        if (!patent) {
          throw new ApolloError('Patent not found', 'PATENT_NOT_FOUND');
        }

        // Generate AI analysis using GPT-4
        const analysis = await GPT4Service.analyzePatent(
          patent.title,
          patent.description,
          patent.claims || []
        );

        return {
          technicalComplexity: analysis.technicalComplexity,
          marketSizeEstimate: analysis.marketPotential * 1000000, // Convert to dollars
          competitiveLandscape: analysis.analysis.opportunities,
          innovationScore: analysis.innovationScore,
          riskFactors: analysis.analysis.risks
        };
      } catch (error) {
        console.error('Error generating AI analysis:', error);
        throw new ApolloError('Failed to generate AI analysis');
      }
    }
  },

  Mutation: {
    createPatent: async (_: any, { input }: { input: PatentInput }, { user }: { user: any }) => {
      if (!user) {
        throw new ApolloError('Not authenticated', 'NOT_AUTHENTICATED');
      }

      try {
        // Create the patent using raw SQL
        await prisma.$executeRaw`
          INSERT INTO "Patent" (
            id, title, description, inventors, jurisdictions, 
            "technicalField", "backgroundArt", claims, status, "ownerId", 
            "createdAt", "updatedAt"
          ) VALUES (
            ${uuidv4()}, ${input.title}, ${input.description}, ${input.inventors}, ${input.jurisdictions},
            ${input.technicalField || null}, ${input.backgroundArt || null}, ${input.claims || []}, 'draft', ${user.userId},
            NOW(), NOW()
          )
        `;

        // Get the created patent
        const createdPatentResult = await prisma.$queryRaw`
          SELECT p.*, u.email as owner_email, u.firstName as owner_firstName, u.lastName as owner_lastName
          FROM "Patent" p
          JOIN "User" u ON p."ownerId" = u.id
          WHERE p."ownerId" = ${user.userId}
          ORDER BY p."createdAt" DESC
          LIMIT 1
        `;

        const createdPatents = createdPatentResult as any[];
        return createdPatents[0];
      } catch (error) {
        console.error('Error creating patent:', error);
        throw new ApolloError('Failed to create patent');
      }
    },

    updatePatent: async (_: any, { id, input }: { id: string, input: PatentInput }, { user }: { user: any }) => {
      if (!user) {
        throw new ApolloError('Not authenticated', 'NOT_AUTHENTICATED');
      }

      try {
        // Check if patent exists and user is owner
        const patentResult = await prisma.$queryRaw`
          SELECT * FROM "Patent"
          WHERE id = ${id}
        `;

        const patents = patentResult as any[];
        const existingPatent = patents[0];

        if (!existingPatent) {
          throw new ApolloError('Patent not found', 'PATENT_NOT_FOUND');
        }

        if (existingPatent.ownerId !== user.userId) {
          throw new ApolloError('Not authorized to update this patent', 'NOT_AUTHORIZED');
        }

        // Update the patent
        await prisma.$executeRaw`
          UPDATE "Patent"
          SET 
            title = ${input.title},
            description = ${input.description},
            inventors = ${input.inventors},
            jurisdictions = ${input.jurisdictions},
            "technicalField" = ${input.technicalField || null},
            "backgroundArt" = ${input.backgroundArt || null},
            claims = ${input.claims || []},
            "updatedAt" = NOW()
          WHERE id = ${id}
        `;

        // Get the updated patent
        const updatedPatentResult = await prisma.$queryRaw`
          SELECT p.*, u.email as owner_email, u.firstName as owner_firstName, u.lastName as owner_lastName
          FROM "Patent" p
          JOIN "User" u ON p."ownerId" = u.id
          WHERE p.id = ${id}
        `;

        const updatedPatents = updatedPatentResult as any[];
        return updatedPatents[0];
      } catch (error) {
        console.error('Error updating patent:', error);
        if (error instanceof ApolloError) {
          throw error;
        }
        throw new ApolloError('Failed to update patent');
      }
    },

    deletePatent: async (_: any, { id }: { id: string }, { user }: { user: any }) => {
      if (!user) {
        throw new ApolloError('Not authenticated', 'NOT_AUTHENTICATED');
      }

      try {
        // Check if patent exists and user is owner
        const patentResult = await prisma.$queryRaw`
          SELECT * FROM "Patent"
          WHERE id = ${id}
        `;

        const patents = patentResult as any[];
        const existingPatent = patents[0];

        if (!existingPatent) {
          throw new ApolloError('Patent not found', 'PATENT_NOT_FOUND');
        }

        if (existingPatent.ownerId !== user.userId) {
          throw new ApolloError('Not authorized to delete this patent', 'NOT_AUTHORIZED');
        }

        // Delete associated documents first
        await prisma.$executeRaw`
          DELETE FROM "Document"
          WHERE "patentId" = ${id}
        `;

        // Delete the patent
        await prisma.$executeRaw`
          DELETE FROM "Patent"
          WHERE id = ${id}
        `;

        return true;
      } catch (error) {
        console.error('Error deleting patent:', error);
        if (error instanceof ApolloError) {
          throw error;
        }
        throw new ApolloError('Failed to delete patent');
      }
    },

    updatePatentStatus: async (_: any, { id, status }: { id: string, status: string }, { user }: { user: any }) => {
      if (!user) {
        throw new ApolloError('Not authenticated', 'NOT_AUTHENTICATED');
      }

      try {
        // Check if patent exists and user is owner
        const patentResult = await prisma.$queryRaw`
          SELECT * FROM "Patent"
          WHERE id = ${id}
        `;

        const patents = patentResult as any[];
        const existingPatent = patents[0];

        if (!existingPatent) {
          throw new ApolloError('Patent not found', 'PATENT_NOT_FOUND');
        }

        if (existingPatent.ownerId !== user.userId) {
          throw new ApolloError('Not authorized to update this patent', 'NOT_AUTHORIZED');
        }

        // Update the patent status
        await prisma.$executeRaw`
          UPDATE "Patent"
          SET 
            status = ${status},
            "updatedAt" = NOW()
          WHERE id = ${id}
        `;

        // Get the updated patent
        const updatedPatentResult = await prisma.$queryRaw`
          SELECT p.*, u.email as owner_email, u.firstName as owner_firstName, u.lastName as owner_lastName
          FROM "Patent" p
          JOIN "User" u ON p."ownerId" = u.id
          WHERE p.id = ${id}
        `;

        const updatedPatents = updatedPatentResult as any[];
        return updatedPatents[0];
      } catch (error) {
        console.error('Error updating patent status:', error);
        if (error instanceof ApolloError) {
          throw error;
        }
        throw new ApolloError('Failed to update patent status');
      }
    },

    uploadDocument: async (_: any, { input }: { input: DocumentUploadInput }, { user }: { user: any }) => {
      if (!user) {
        throw new ApolloError('Not authenticated', 'NOT_AUTHENTICATED');
      }

      try {
        const { patentId, name, type, file } = input;

        // Check if patent exists and user is owner
        const patentResult = await prisma.$queryRaw`
          SELECT * FROM "Patent"
          WHERE id = ${patentId}
        `;

        const patents = patentResult as any[];
        const patent = patents[0];

        if (!patent) {
          throw new ApolloError('Patent not found', 'PATENT_NOT_FOUND');
        }

        if (patent.ownerId !== user.userId) {
          throw new ApolloError('Not authorized to upload documents to this patent', 'NOT_AUTHORIZED');
        }

        // Process file upload
        const { createReadStream, filename } = await file;
        const fileId = uuidv4();
        const fileExtension = path.extname(filename);
        const newFilename = `${fileId}${fileExtension}`;
        const filePath = path.join(process.cwd(), 'uploads', newFilename);
        
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!require('fs').existsSync(uploadsDir)) {
          require('fs').mkdirSync(uploadsDir, { recursive: true });
        }

        // Save the file
        const stream = createReadStream();
        const out = createWriteStream(filePath);
        stream.pipe(out);
        await finished(out);

        // Create document record
        const documentId = uuidv4();
        await prisma.$executeRaw`
          INSERT INTO "Document" (
            id, name, type, url, "patentId", "createdAt", "updatedAt"
          ) VALUES (
            ${documentId}, ${name}, ${type}, ${`/uploads/${newFilename}`}, ${patentId}, NOW(), NOW()
          )
        `;

        // Get the created document
        const documentResult = await prisma.$queryRaw`
          SELECT * FROM "Document"
          WHERE id = ${documentId}
        `;

        const documents = documentResult as any[];
        return documents[0];
      } catch (error) {
        console.error('Error uploading document:', error);
        throw new ApolloError('Failed to upload document');
      }
    },

    deleteDocument: async (_: any, { documentId }: { documentId: string }, { user }: { user: any }) => {
      if (!user) {
        throw new ApolloError('Not authenticated', 'NOT_AUTHENTICATED');
      }

      try {
        // Find the document and its associated patent
        const documentResult = await prisma.$queryRaw`
          SELECT d.*, p."ownerId"
          FROM "Document" d
          JOIN "Patent" p ON d."patentId" = p.id
          WHERE d.id = ${documentId}
        `;

        const documents = documentResult as any[];
        const document = documents[0];

        if (!document) {
          throw new ApolloError('Document not found', 'DOCUMENT_NOT_FOUND');
        }

        // Check if user is the patent owner
        if (document.ownerId !== user.userId) {
          throw new ApolloError('Not authorized to delete this document', 'NOT_AUTHORIZED');
        }

        // Delete the file
        const filePath = path.join(process.cwd(), document.url.substring(1));
        if (require('fs').existsSync(filePath)) {
          require('fs').unlinkSync(filePath);
        }

        // Delete the document record
        await prisma.$executeRaw`
          DELETE FROM "Document"
          WHERE id = ${documentId}
        `;

        return true;
      } catch (error) {
        console.error('Error deleting document:', error);
        if (error instanceof ApolloError) {
          throw error;
        }
        throw new ApolloError('Failed to delete document');
      }
    },

    generateSearchReport: async (_: any, { patentId }: { patentId: string }, { user }: { user: any }) => {
      if (!user) {
        throw new ApolloError('Not authenticated', 'NOT_AUTHENTICATED');
      }

      try {
        // Get the patent
        const patentResult = await prisma.$queryRaw`
          SELECT * FROM "Patent"
          WHERE id = ${patentId}
        `;

        const patents = patentResult as any[];
        const patent = patents[0];

        if (!patent) {
          throw new ApolloError('Patent not found', 'PATENT_NOT_FOUND');
        }

        if (patent.ownerId !== user.userId) {
          throw new ApolloError('Not authorized to generate report for this patent', 'NOT_AUTHORIZED');
        }

        // Generate similarity analysis using BERT
        const similarityResults = await BERTService.analyzeSimilarity(
          patent.title,
          patent.description,
          patent.claims || []
        );

        // Generate AI analysis using GPT-4
        const aiAnalysis = await GPT4Service.analyzePatent(
          patent.title,
          patent.description,
          patent.claims || []
        );

        // Generate recommendations
        const recommendations = await PatentAIService.generateRecommendations(
          patent.title,
          patent.description,
          patent.claims || [],
          similarityResults,
          aiAnalysis
        );

        // Create search report
        const searchReport = {
          similarityScore: similarityResults.overallScore,
          priorArtReferences: similarityResults.references.map(ref => ({
            patentNumber: ref.patentNumber,
            title: ref.title,
            relevanceScore: ref.relevanceScore,
            matchingClaims: ref.matchingClaims,
            publicationDate: ref.publicationDate
          })),
          aiAnalysis: {
            technicalComplexity: aiAnalysis.technicalComplexity,
            marketSizeEstimate: aiAnalysis.marketPotential * 1000000, // Convert to dollars
            competitiveLandscape: aiAnalysis.analysis.opportunities,
            innovationScore: aiAnalysis.innovationScore,
            riskFactors: aiAnalysis.analysis.risks
          },
          recommendations
        };

        // Update the patent with the search report
        await prisma.$executeRaw`
          UPDATE "Patent"
          SET 
            "searchReport" = ${JSON.stringify(searchReport)},
            "uniquenessScore" = ${100 - (similarityResults.overallScore * 100)},
            "marketPotential" = ${aiAnalysis.marketPotential},
            "updatedAt" = NOW()
          WHERE id = ${patentId}
        `;

        return searchReport;
      } catch (error) {
        console.error('Error generating search report:', error);
        throw new ApolloError('Failed to generate search report');
      }
    }
  }
}; 