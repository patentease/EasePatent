import { pipeline } from '@xenova/transformers';

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

interface ClassificationOutput {
  label: string;
  score: number;
}

interface SummarizationOutput {
  summary_text: string;
}

interface TokenClassificationOutput {
  word: string;
  entity: string;
}

type Tensor = number[] | number[][];

type ClassificationPipeline = {
  (text: string, options?: { topk?: number }): Promise<ClassificationOutput[]>;
};

type FeatureExtractionPipeline = {
  (text: string): Promise<Tensor>;
};

type SummarizationPipeline = {
  (text: string, options?: { max_length?: number; min_length?: number; do_sample?: boolean }): Promise<SummarizationOutput>;
};

type TokenClassificationPipeline = {
  (text: string): Promise<TokenClassificationOutput[]>;
};

export class BERTService {
  private static classifier: ClassificationPipeline | null = null;
  private static similarityModel: FeatureExtractionPipeline | null = null;
  private static summaryModel: SummarizationPipeline | null = null;
  private static featureModel: TokenClassificationPipeline | null = null;

  private static async initializeClassifier(): Promise<ClassificationPipeline> {
    if (!this.classifier) {
      const model = await pipeline('text-classification', 'Xenova/bert-base-patent-classification');
      this.classifier = ((text: string, options?: { topk?: number }) => 
        model(text, options)) as unknown as ClassificationPipeline;
    }
    return this.classifier;
  }

  private static async initializeSimilarityModel(): Promise<FeatureExtractionPipeline> {
    if (!this.similarityModel) {
      const model = await pipeline('feature-extraction', 'Xenova/bert-base-patent-similarity');
      this.similarityModel = ((text: string) => 
        model(text)) as unknown as FeatureExtractionPipeline;
    }
    return this.similarityModel;
  }

  private static async initializeSummaryModel(): Promise<SummarizationPipeline> {
    if (!this.summaryModel) {
      const model = await pipeline('summarization', 'Xenova/bert-base-technical-summary');
      this.summaryModel = ((text: string, options?: { max_length?: number; min_length?: number; do_sample?: boolean }) => 
        model(text, options)) as unknown as SummarizationPipeline;
    }
    return this.summaryModel;
  }

  private static async initializeFeatureModel(): Promise<TokenClassificationPipeline> {
    if (!this.featureModel) {
      const model = await pipeline('token-classification', 'Xenova/bert-base-technical-features');
      this.featureModel = ((text: string) => 
        model(text)) as unknown as TokenClassificationPipeline;
    }
    return this.featureModel;
  }

  public static async classifyPatent(text: string): Promise<BERTClassificationResult[]> {
    try {
      const classifier = await this.initializeClassifier();
      const result = await classifier(text, {
        topk: 3
      });

      return result.map((r: ClassificationOutput) => ({
        label: r.label,
        score: r.score
      }));
    } catch (error) {
      console.error('Error in BERT classification:', error);
      throw new Error('Failed to classify patent text with BERT');
    }
  }

  public static async calculateSimilarity(text1: string, text2: string): Promise<number> {
    try {
      const model = await this.initializeSimilarityModel();
      const [embedding1, embedding2] = await Promise.all([
        model(text1),
        model(text2)
      ]);

      return this.cosineSimilarity(
        embedding1 as number[],
        embedding2 as number[]
      );
    } catch (error) {
      console.error('Error in BERT similarity calculation:', error);
      throw new Error('Failed to calculate similarity with BERT');
    }
  }

  public static async findSimilarSegments(
    sourceText: string,
    targetText: string,
    threshold: number = 0.7
  ): Promise<BERTSimilarityResult> {
    try {
      const model = await this.initializeSimilarityModel();
      const sourceEmbedding = await model(sourceText) as number[];
      
      const segments = this.splitIntoSegments(targetText);
      const matchingSegments = [];

      for (const segment of segments) {
        const segmentEmbedding = await model(segment) as number[];
        const similarity = this.cosineSimilarity(sourceEmbedding, segmentEmbedding);

        if (similarity >= threshold) {
          matchingSegments.push({
            text: segment,
            similarity
          });
        }
      }

      const overallScore = matchingSegments.length > 0
        ? matchingSegments.reduce((acc, curr) => acc + curr.similarity, 0) / matchingSegments.length
        : 0;

      return {
        score: overallScore,
        matchingSegments: matchingSegments.sort((a, b) => b.similarity - a.similarity)
      };
    } catch (error) {
      console.error('Error in BERT segment analysis:', error);
      throw new Error('Failed to analyze text segments with BERT');
    }
  }

  private static splitIntoSegments(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .filter(segment => segment.trim().length > 0);
  }

  private static cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    const dotProduct = embedding1.reduce((sum, a, idx) => sum + a * embedding2[idx], 0);
    const norm1 = Math.sqrt(embedding1.reduce((sum, a) => sum + a * a, 0));
    const norm2 = Math.sqrt(embedding2.reduce((sum, a) => sum + a * a, 0));
    return dotProduct / (norm1 * norm2);
  }

  public static async generateTechnicalSummary(text: string): Promise<string> {
    try {
      const model = await this.initializeSummaryModel();
      const result = await model(text, {
        max_length: 150,
        min_length: 50,
        do_sample: false
      });

      return result.summary_text;
    } catch (error) {
      console.error('Error in BERT summarization:', error);
      throw new Error('Failed to generate technical summary with BERT');
    }
  }

  public static async extractKeyFeatures(text: string): Promise<string[]> {
    try {
      const model = await this.initializeFeatureModel();
      const result = await model(text);

      const features: string[] = [];
      let currentFeature = '';
      let currentType = '';

      result.forEach((token: TokenClassificationOutput) => {
        if (token.entity === currentType) {
          currentFeature += ' ' + token.word;
        } else {
          if (currentFeature) {
            features.push(currentFeature.trim());
          }
          currentFeature = token.word;
          currentType = token.entity;
        }
      });

      if (currentFeature) {
        features.push(currentFeature.trim());
      }

      return features;
    } catch (error) {
      console.error('Error in BERT feature extraction:', error);
      throw new Error('Failed to extract features with BERT');
    }
  }
}

export default BERTService; 