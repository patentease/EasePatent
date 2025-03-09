import { Router } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { BERTService } from '../ai/services/bertService';
import { GPT4Service } from '../ai/services/gpt4Service';
import { PatentAIService } from '../ai/services/patentAIService';
import { createWriteStream } from 'fs';
import { finished } from 'stream/promises';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${fileId}${ext}`);
  }
});

const upload = multer({ storage });

const router = Router();

// Get user's patents
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;

    const patentsResult = await prisma.$queryRaw`
      SELECT p.*, u.email as owner_email, u.firstName as owner_firstName, u.lastName as owner_lastName
      FROM "Patent" p
      JOIN "User" u ON p."ownerId" = u.id
      WHERE p."ownerId" = ${userId}
    `;

    res.json(patentsResult);
  } catch (error) {
    console.error('Error fetching user patents:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch patents',
        code: 'FETCH_PATENTS_FAILED'
      }
    });
  }
});

// Get single patent
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const patentsResult = await prisma.$queryRaw`
      SELECT p.*, u.email as owner_email, u.firstName as owner_firstName, u.lastName as owner_lastName
      FROM "Patent" p
      JOIN "User" u ON p."ownerId" = u.id
      WHERE p.id = ${id}
    `;

    const patents = patentsResult as any[];
    const patent = patents[0];

    if (!patent) {
      return res.status(404).json({
        error: {
          message: 'Patent not found',
          code: 'PATENT_NOT_FOUND'
        }
      });
    }

    if (patent.ownerId !== userId) {
      return res.status(403).json({
        error: {
          message: 'Not authorized to view this patent',
          code: 'NOT_AUTHORIZED'
        }
      });
    }

    // Get documents for this patent
    const documentsResult = await prisma.$queryRaw`
      SELECT * FROM "Document"
      WHERE "patentId" = ${id}
    `;

    res.json({
      ...patent,
      documents: documentsResult
    });
  } catch (error) {
    console.error('Error fetching patent:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch patent',
        code: 'FETCH_PATENT_FAILED'
      }
    });
  }
});

// Search patents
router.post('/search', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const {
      query,
      technicalField,
      dateRange,
      jurisdictions,
      status,
      sortBy = 'createdAt_DESC',
      page = 1,
      limit = 10
    } = req.body;

    // Build SQL query conditions
    let conditions = [`"ownerId" = '${userId}'`];

    if (query) {
      conditions.push(`(title ILIKE '%${query}%' OR description ILIKE '%${query}%')`);
    }

    if (technicalField) {
      conditions.push(`"technicalField" ILIKE '%${technicalField}%'`);
    }

    if (jurisdictions && jurisdictions.length > 0) {
      conditions.push(`jurisdictions && ARRAY[${jurisdictions.map((j: string) => `'${j}'`).join(',')}]`);
    }

    if (status && status.length > 0) {
      conditions.push(`status IN (${status.map((s: string) => `'${s}'`).join(',')})`);
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

    res.json({
      patents: patentsWithDocuments,
      totalCount,
      page,
      totalPages
    });
  } catch (error) {
    console.error('Error searching patents:', error);
    res.status(500).json({
      error: {
        message: 'Failed to search patents',
        code: 'SEARCH_PATENTS_FAILED'
      }
    });
  }
});

// Create patent
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const {
      title,
      description,
      inventors,
      jurisdictions,
      technicalField,
      backgroundArt,
      claims
    } = req.body;

    // Create the patent using raw SQL
    await prisma.$executeRaw`
      INSERT INTO "Patent" (
        id, title, description, inventors, jurisdictions, 
        "technicalField", "backgroundArt", claims, status, "ownerId", 
        "createdAt", "updatedAt"
      ) VALUES (
        ${uuidv4()}, ${title}, ${description}, ${inventors}, ${jurisdictions},
        ${technicalField || null}, ${backgroundArt || null}, ${claims || []}, 'draft', ${userId},
        NOW(), NOW()
      )
    `;

    // Get the created patent
    const createdPatentResult = await prisma.$queryRaw`
      SELECT p.*, u.email as owner_email, u.firstName as owner_firstName, u.lastName as owner_lastName
      FROM "Patent" p
      JOIN "User" u ON p."ownerId" = u.id
      WHERE p."ownerId" = ${userId}
      ORDER BY p."createdAt" DESC
      LIMIT 1
    `;

    const createdPatents = createdPatentResult as any[];
    res.json(createdPatents[0]);
  } catch (error) {
    console.error('Error creating patent:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create patent',
        code: 'CREATE_PATENT_FAILED'
      }
    });
  }
});

// Update patent
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const {
      title,
      description,
      inventors,
      jurisdictions,
      technicalField,
      backgroundArt,
      claims
    } = req.body;

    // Check if patent exists and user is owner
    const patentResult = await prisma.$queryRaw`
      SELECT * FROM "Patent"
      WHERE id = ${id}
    `;

    const patents = patentResult as any[];
    const existingPatent = patents[0];

    if (!existingPatent) {
      return res.status(404).json({
        error: {
          message: 'Patent not found',
          code: 'PATENT_NOT_FOUND'
        }
      });
    }

    if (existingPatent.ownerId !== userId) {
      return res.status(403).json({
        error: {
          message: 'Not authorized to update this patent',
          code: 'NOT_AUTHORIZED'
        }
      });
    }

    // Update the patent
    await prisma.$executeRaw`
      UPDATE "Patent"
      SET 
        title = ${title},
        description = ${description},
        inventors = ${inventors},
        jurisdictions = ${jurisdictions},
        "technicalField" = ${technicalField || null},
        "backgroundArt" = ${backgroundArt || null},
        claims = ${claims || []},
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
    res.json(updatedPatents[0]);
  } catch (error) {
    console.error('Error updating patent:', error);
    res.status(500).json({
      error: {
        message: 'Failed to update patent',
        code: 'UPDATE_PATENT_FAILED'
      }
    });
  }
});

// Delete patent
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    // Check if patent exists and user is owner
    const patentResult = await prisma.$queryRaw`
      SELECT * FROM "Patent"
      WHERE id = ${id}
    `;

    const patents = patentResult as any[];
    const existingPatent = patents[0];

    if (!existingPatent) {
      return res.status(404).json({
        error: {
          message: 'Patent not found',
          code: 'PATENT_NOT_FOUND'
        }
      });
    }

    if (existingPatent.ownerId !== userId) {
      return res.status(403).json({
        error: {
          message: 'Not authorized to delete this patent',
          code: 'NOT_AUTHORIZED'
        }
      });
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

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting patent:', error);
    res.status(500).json({
      error: {
        message: 'Failed to delete patent',
        code: 'DELETE_PATENT_FAILED'
      }
    });
  }
});

// Update patent status
router.patch('/:id/status', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const { status } = req.body;

    // Check if patent exists and user is owner
    const patentResult = await prisma.$queryRaw`
      SELECT * FROM "Patent"
      WHERE id = ${id}
    `;

    const patents = patentResult as any[];
    const existingPatent = patents[0];

    if (!existingPatent) {
      return res.status(404).json({
        error: {
          message: 'Patent not found',
          code: 'PATENT_NOT_FOUND'
        }
      });
    }

    if (existingPatent.ownerId !== userId) {
      return res.status(403).json({
        error: {
          message: 'Not authorized to update this patent',
          code: 'NOT_AUTHORIZED'
        }
      });
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
    res.json(updatedPatents[0]);
  } catch (error) {
    console.error('Error updating patent status:', error);
    res.status(500).json({
      error: {
        message: 'Failed to update patent status',
        code: 'UPDATE_STATUS_FAILED'
      }
    });
  }
});

// Upload document
router.post('/:patentId/documents', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const { patentId } = req.params;
    const userId = req.user?.userId;
    const { name, type } = req.body;

    if (!req.file) {
      return res.status(400).json({
        error: {
          message: 'No file uploaded',
          code: 'NO_FILE'
        }
      });
    }

    // Check if patent exists and user is owner
    const patentResult = await prisma.$queryRaw`
      SELECT * FROM "Patent"
      WHERE id = ${patentId}
    `;

    const patents = patentResult as any[];
    const patent = patents[0];

    if (!patent) {
      return res.status(404).json({
        error: {
          message: 'Patent not found',
          code: 'PATENT_NOT_FOUND'
        }
      });
    }

    if (patent.ownerId !== userId) {
      return res.status(403).json({
        error: {
          message: 'Not authorized to upload documents to this patent',
          code: 'NOT_AUTHORIZED'
        }
      });
    }

    // Create document record
    const documentId = uuidv4();
    await prisma.$executeRaw`
      INSERT INTO "Document" (
        id, name, type, url, "patentId", "createdAt", "updatedAt"
      ) VALUES (
        ${documentId}, ${name}, ${type}, ${`/uploads/${req.file.filename}`}, ${patentId}, NOW(), NOW()
      )
    `;

    // Get the created document
    const documentResult = await prisma.$queryRaw`
      SELECT * FROM "Document"
      WHERE id = ${documentId}
    `;

    const documents = documentResult as any[];
    res.json(documents[0]);
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      error: {
        message: 'Failed to upload document',
        code: 'UPLOAD_DOCUMENT_FAILED'
      }
    });
  }
});

// Delete document
router.delete('/:patentId/documents/:documentId', async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.userId;

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
      return res.status(404).json({
        error: {
          message: 'Document not found',
          code: 'DOCUMENT_NOT_FOUND'
        }
      });
    }

    // Check if user is the patent owner
    if (document.ownerId !== userId) {
      return res.status(403).json({
        error: {
          message: 'Not authorized to delete this document',
          code: 'NOT_AUTHORIZED'
        }
      });
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

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      error: {
        message: 'Failed to delete document',
        code: 'DELETE_DOCUMENT_FAILED'
      }
    });
  }
});

// Get similar patents
router.get('/:id/similar', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    // Get the source patent
    const patentResult = await prisma.$queryRaw`
      SELECT * FROM "Patent"
      WHERE id = ${id}
    `;

    const patents = patentResult as any[];
    const patent = patents[0];

    if (!patent) {
      return res.status(404).json({
        error: {
          message: 'Patent not found',
          code: 'PATENT_NOT_FOUND'
        }
      });
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
      return res.json([]);
    }
    
    const similarPatentsResult = await prisma.$queryRaw`
      SELECT p.*, u.email as owner_email, u.firstName as owner_firstName, u.lastName as owner_lastName
      FROM "Patent" p
      JOIN "User" u ON p."ownerId" = u.id
      WHERE p.id IN (${patentIds.join(',')})
    `;

    res.json(similarPatentsResult);
  } catch (error) {
    console.error('Error finding similar patents:', error);
    res.status(500).json({
      error: {
        message: 'Failed to find similar patents',
        code: 'FIND_SIMILAR_FAILED'
      }
    });
  }
});

// Get AI analysis
router.get('/:id/analysis', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const patentResult = await prisma.$queryRaw`
      SELECT * FROM "Patent"
      WHERE id = ${id}
    `;

    const patents = patentResult as any[];
    const patent = patents[0];

    if (!patent) {
      return res.status(404).json({
        error: {
          message: 'Patent not found',
          code: 'PATENT_NOT_FOUND'
        }
      });
    }

    // Generate AI analysis using GPT-4
    const analysis = await GPT4Service.analyzePatent(
      patent.title,
      patent.description,
      patent.claims || []
    );

    res.json({
      technicalComplexity: analysis.technicalComplexity,
      marketSizeEstimate: analysis.marketPotential * 1000000, // Convert to dollars
      competitiveLandscape: analysis.analysis.opportunities,
      innovationScore: analysis.innovationScore,
      riskFactors: analysis.analysis.risks
    });
  } catch (error) {
    console.error('Error generating AI analysis:', error);
    res.status(500).json({
      error: {
        message: 'Failed to generate AI analysis',
        code: 'GENERATE_ANALYSIS_FAILED'
      }
    });
  }
});

// Generate search report
router.post('/:id/search-report', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    // Get the patent
    const patentResult = await prisma.$queryRaw`
      SELECT * FROM "Patent"
      WHERE id = ${id}
    `;

    const patents = patentResult as any[];
    const patent = patents[0];

    if (!patent) {
      return res.status(404).json({
        error: {
          message: 'Patent not found',
          code: 'PATENT_NOT_FOUND'
        }
      });
    }

    if (patent.ownerId !== userId) {
      return res.status(403).json({
        error: {
          message: 'Not authorized to generate report for this patent',
          code: 'NOT_AUTHORIZED'
        }
      });
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
      WHERE id = ${id}
    `;

    res.json(searchReport);
  } catch (error) {
    console.error('Error generating search report:', error);
    res.status(500).json({
      error: {
        message: 'Failed to generate search report',
        code: 'GENERATE_REPORT_FAILED'
      }
    });
  }
});

export const patentRouter = router; 