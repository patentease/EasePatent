import GPT4Service, { GPTPatentAnalysis } from './gpt4Service';
import BERTService, { BERTSimilarityResult, BERTClassificationResult } from './bertService';

export interface PatentAnalysisResult {
  gptAnalysis: GPTPatentAnalysis;
  technicalClassification: BERTClassificationResult[];
  keyFeatures: string[];
  technicalSummary: string;
}

export interface SimilarityAnalysisResult {
  overallSimilarity: number;
  detailedAnalysis: BERTSimilarityResult;
  recommendations: string[];
}

export class PatentAIService {
  public static async analyzePatent(
    title: string,
    description: string,
    claims: string[]
  ): Promise<PatentAnalysisResult> {
    try {
      // Run analyses in parallel
      const [
        gptAnalysis,
        technicalClassification,
        keyFeatures,
        technicalSummary
      ] = await Promise.all([
        GPT4Service.analyzePatent(title, description, claims),
        BERTService.classifyPatent(description),
        BERTService.extractKeyFeatures(description),
        BERTService.generateTechnicalSummary(description)
      ]);

      return {
        gptAnalysis,
        technicalClassification,
        keyFeatures,
        technicalSummary
      };
    } catch (error) {
      console.error('Error in comprehensive patent analysis:', error);
      throw new Error('Failed to complete patent analysis');
    }
  }

  public static async analyzeSimilarity(
    sourcePatent: {
      title: string;
      description: string;
      claims: string[];
    },
    targetPatent: {
      title: string;
      description: string;
      claims: string[];
    }
  ): Promise<SimilarityAnalysisResult> {
    try {
      // Combine texts for overall similarity
      const sourceText = `${sourcePatent.title}\n${sourcePatent.description}\n${sourcePatent.claims.join('\n')}`;
      const targetText = `${targetPatent.title}\n${targetPatent.description}\n${targetPatent.claims.join('\n')}`;

      // Run analyses in parallel
      const [
        overallSimilarity,
        detailedAnalysis,
        gptRecommendations
      ] = await Promise.all([
        BERTService.calculateSimilarity(sourceText, targetText),
        BERTService.findSimilarSegments(sourceText, targetText),
        GPT4Service.generateImprovedClaims(sourcePatent.claims, [targetText])
      ]);

      return {
        overallSimilarity,
        detailedAnalysis,
        recommendations: gptRecommendations
      };
    } catch (error) {
      console.error('Error in similarity analysis:', error);
      throw new Error('Failed to complete similarity analysis');
    }
  }

  public static async generateSearchStrategy(
    title: string,
    description: string
  ): Promise<{
    gptStrategy: {
      keywords: string[];
      classifications: string[];
      searchQueries: string[];
    };
    bertFeatures: string[];
    technicalClassification: BERTClassificationResult[];
  }> {
    try {
      const [
        gptStrategy,
        bertFeatures,
        technicalClassification
      ] = await Promise.all([
        GPT4Service.generateSearchStrategy(`${title}\n${description}`),
        BERTService.extractKeyFeatures(description),
        BERTService.classifyPatent(description)
      ]);

      return {
        gptStrategy,
        bertFeatures,
        technicalClassification
      };
    } catch (error) {
      console.error('Error generating search strategy:', error);
      throw new Error('Failed to generate search strategy');
    }
  }

  public static async assessPatentability(
    invention: {
      title: string;
      description: string;
      claims: string[];
    },
    priorArt: Array<{
      title: string;
      description: string;
      claims: string[];
    }>
  ): Promise<{
    gptAssessment: {
      score: number;
      analysis: string;
      recommendations: string[];
    };
    similarityScores: Array<{
      patentIndex: number;
      similarity: number;
      details: BERTSimilarityResult;
    }>;
  }> {
    try {
      const inventionText = `${invention.title}\n${invention.description}\n${invention.claims.join('\n')}`;
      
      // Process each prior art patent
      const similarityPromises = priorArt.map(async (art, index) => {
        const artText = `${art.title}\n${art.description}\n${art.claims.join('\n')}`;
        const [similarity, details] = await Promise.all([
          BERTService.calculateSimilarity(inventionText, artText),
          BERTService.findSimilarSegments(inventionText, artText)
        ]);

        return {
          patentIndex: index,
          similarity,
          details
        };
      });

      // Run GPT-4 assessment and similarity analysis in parallel
      const [gptAssessment, similarityScores] = await Promise.all([
        GPT4Service.assessPatentability(
          inventionText,
          priorArt.map(art => `${art.title}\n${art.description}`)
        ),
        Promise.all(similarityPromises)
      ]);

      return {
        gptAssessment,
        similarityScores: similarityScores.sort((a, b) => b.similarity - a.similarity)
      };
    } catch (error) {
      console.error('Error in patentability assessment:', error);
      throw new Error('Failed to assess patentability');
    }
  }
}

export default PatentAIService; 