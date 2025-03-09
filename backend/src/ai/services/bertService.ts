import { prisma } from '../../db';

export interface BERTSimilarityResult {
  score: number;
  matchingSegments: Array<{
    text: string;
    similarity: number;
  }>;
}

export interface BERTClassificationResult {
  label: string;
  score: number;
}

interface PipelineResult {
  label: string;
  score: number;
  summary_text?: string;
  word?: string;
  entity?: string;
}

export interface SimilarityResult {
  overallScore: number;
  references: Array<{
    patentNumber: string;
    title: string;
    relevanceScore: number;
    matchingClaims: string[];
    publicationDate: string;
  }>;
}

export class BERTService {
  private static classifier: any = null;
  private static similarityModel: any = null;
  private static summarizer: any = null;
  private static nerModel: any = null;
  private static pipeline: any = null;

  /**
   * Initialize all BERT models
   */
  public static async initialize() {
    try {
      console.log('Initializing BERT models...');
      
      // Import the pipeline dynamically
      if (!this.pipeline) {
        const transformers = await import('@xenova/transformers');
        this.pipeline = transformers.pipeline;
      }
      
      // Initialize feature extraction model for similarity
      if (!this.similarityModel) {
        this.similarityModel = await this.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('Similarity model initialized');
      }
      
      // Initialize classifier
      if (!this.classifier) {
        this.classifier = await this.pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
        console.log('Classifier initialized');
      }
      
      // Initialize summarizer
      if (!this.summarizer) {
        this.summarizer = await this.pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
        console.log('Summarizer initialized');
      }
      
      // Initialize NER model
      if (!this.nerModel) {
        this.nerModel = await this.pipeline('token-classification', 'Xenova/bert-base-NER');
        console.log('NER model initialized');
      }
      
      console.log('All BERT models initialized successfully');
    } catch (error) {
      console.error('Error initializing BERT models:', error);
      throw new Error('Failed to initialize BERT models');
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private static cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Get embedding for a text
   */
  private static async getEmbedding(text: string): Promise<number[]> {
    if (!this.similarityModel) {
      await this.initialize();
    }
    
    try {
      const result = await this.similarityModel!(text) as number[][] | number[];
      
      // Average the embeddings across all tokens if result is a 2D array
      if (Array.isArray(result) && Array.isArray(result[0])) {
        const length = (result[0] as number[]).length;
        const sum = new Array(length).fill(0);
        for (const vec of result as number[][]) {
          for (let i = 0; i < length; i++) {
            sum[i] += vec[i];
          }
        }
        return sum.map(v => v / result.length);
      }
      
      return result as number[];
    } catch (error) {
      console.error('Error getting embedding:', error);
      throw new Error('Failed to get embedding');
    }
  }

  /**
   * Mock implementation of finding similar patents
   */
  public static async findSimilarPatents(
    title: string,
    description: string,
    claims: string[]
  ): Promise<Array<{ id: string; similarity: number }>> {
    return [
      { id: 'patent1', similarity: 0.85 },
      { id: 'patent2', similarity: 0.75 },
      { id: 'patent3', similarity: 0.65 }
    ];
  }

  /**
   * Mock implementation of similarity analysis
   */
  public static async analyzeSimilarity(
    title: string,
    description: string,
    claims: string[]
  ): Promise<SimilarityResult> {
    return {
      overallScore: 0.25,
      references: [
        {
          patentNumber: 'US123456',
          title: 'Similar Patent 1',
          relevanceScore: 0.85,
          matchingClaims: ['Claim 1', 'Claim 3'],
          publicationDate: '2022-01-01'
        },
        {
          patentNumber: 'US789012',
          title: 'Similar Patent 2',
          relevanceScore: 0.75,
          matchingClaims: ['Claim 2'],
          publicationDate: '2021-06-15'
        }
      ]
    };
  }

  /**
   * Classify text into categories
   */
  public static async classifyText(text: string): Promise<BERTClassificationResult[]> {
    if (!this.classifier) {
      await this.initialize();
    }
    
    try {
      const result = await this.classifier!(text, { topk: 2 }) as PipelineResult[];
      return result.map((item: PipelineResult) => ({
        label: item.label,
        score: item.score
      }));
    } catch (error) {
      console.error('Error classifying text:', error);
      throw new Error('Failed to classify text');
    }
  }

  /**
   * Summarize text
   */
  public static async summarizeText(text: string, maxLength: number = 150): Promise<string> {
    if (!this.summarizer) {
      await this.initialize();
    }
    
    try {
      // Truncate input if too long (model has limits)
      const truncatedText = text.length > 1000 ? text.substring(0, 1000) : text;
      
      const result = await this.summarizer!(truncatedText, {
        max_length: maxLength,
        min_length: 30,
        do_sample: false
      }) as PipelineResult;
      
      return result.summary_text || '';
    } catch (error) {
      console.error('Error summarizing text:', error);
      throw new Error('Failed to summarize text');
    }
  }

  /**
   * Extract entities from text
   */
  public static async extractEntities(text: string): Promise<Record<string, string[]>> {
    if (!this.nerModel) {
      await this.initialize();
    }
    
    try {
      const entities = await this.nerModel!(text) as PipelineResult[];
      
      // Group entities by type
      const groupedEntities: Record<string, string[]> = {};
      
      entities.forEach((entity: PipelineResult) => {
        if (entity.entity && entity.word) {
          const type = entity.entity.replace('B-', '').replace('I-', '');
          if (!groupedEntities[type]) {
            groupedEntities[type] = [];
          }
          
          if (!groupedEntities[type].includes(entity.word)) {
            groupedEntities[type].push(entity.word);
          }
        }
      });
      
      return groupedEntities;
    } catch (error) {
      console.error('Error extracting entities:', error);
      throw new Error('Failed to extract entities');
    }
  }
}

export default BERTService; 