import { GPT4Service, GPTPatentAnalysis } from './gpt4Service';
import { BERTService, SimilarityResult } from './bertService';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class PatentAIService {
  /**
   * Mock implementation of generating recommendations
   */
  public static async generateRecommendations(
    title: string,
    description: string,
    claims: string[],
    similarityResults: SimilarityResult,
    aiAnalysis: GPTPatentAnalysis
  ): Promise<string[]> {
    return [
      'Consider adding more specific technical details to differentiate from similar patents',
      'Strengthen independent claims by incorporating unique technical features',
      'Add dependent claims to cover specific implementations',
      'Include more examples in the description',
      'Consider expanding into adjacent technical fields'
    ];
  }

  /**
   * Predict patent approval chances
   */
  public static async predictApprovalChances(
    title: string,
    description: string,
    claims: string[],
    similarityResults: SimilarityResult
  ): Promise<{ approvalChance: number; factors: Record<string, number>; suggestions: string[] }> {
    try {
      // Convert similarity results to the format expected by GPT-4 service
      const priorArtReferences = similarityResults.references.map((ref: { title: string; relevanceScore: number }) => ({
        title: ref.title,
        relevanceScore: ref.relevanceScore
      }));
      
      // Use GPT-4 to predict approval chances
      const prediction = await GPT4Service.predictApprovalChances(
        title,
        claims,
        priorArtReferences
      );
      
      // Calculate factors affecting approval
      const noveltyScore = 100 - (similarityResults.overallScore * 100);
      const claimClarityScore = await this.assessClaimClarity(claims);
      const technicalDetailScore = await this.assessTechnicalDetail(description);
      
      return {
        approvalChance: prediction.approvalChance,
        factors: {
          novelty: noveltyScore,
          claimClarity: claimClarityScore,
          technicalDetail: technicalDetailScore,
          priorArtImpact: similarityResults.overallScore * 100
        },
        suggestions: prediction.suggestedImprovements
      };
    } catch (error) {
      console.error('Error predicting approval chances:', error);
      
      // Return default prediction
      return {
        approvalChance: 60,
        factors: {
          novelty: 70,
          claimClarity: 65,
          technicalDetail: 75,
          priorArtImpact: 30
        },
        suggestions: [
          'Improve claim clarity by using more precise language',
          'Add more technical details to differentiate from prior art',
          'Consider narrowing the scope of the broadest claims'
        ]
      };
    }
  }

  /**
   * Assess the clarity of patent claims
   */
  private static async assessClaimClarity(claims: string[]): Promise<number> {
    try {
      const prompt = `
        Assess the clarity of these patent claims on a scale of 0-100:
        
        ${claims.join('\n')}
        
        Consider:
        1. Precision of language
        2. Logical structure
        3. Absence of ambiguity
        4. Proper claim dependencies
        5. Technical specificity
        
        Return only a number between 0-100.
      `;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 10
      });
      
      const response = completion.choices[0].message?.content || '';
      const score = parseInt(response.trim(), 10);
      
      return isNaN(score) ? 70 : score;
    } catch (error) {
      console.error('Error assessing claim clarity:', error);
      return 70; // Default score
    }
  }

  /**
   * Assess the technical detail of a patent description
   */
  private static async assessTechnicalDetail(description: string): Promise<number> {
    try {
      // Truncate description if too long
      const truncatedDescription = description.length > 1000 
        ? description.substring(0, 1000) + '...'
        : description;
      
      const prompt = `
        Assess the level of technical detail in this patent description on a scale of 0-100:
        
        ${truncatedDescription}
        
        Consider:
        1. Specificity of technical information
        2. Presence of examples and embodiments
        3. Quantitative data and measurements
        4. Implementation details
        5. Comprehensiveness of the description
        
        Return only a number between 0-100.
      `;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 10
      });
      
      const response = completion.choices[0].message?.content || '';
      const score = parseInt(response.trim(), 10);
      
      return isNaN(score) ? 75 : score;
    } catch (error) {
      console.error('Error assessing technical detail:', error);
      return 75; // Default score
    }
  }

  /**
   * Generate a market analysis for a patent
   */
  public static async generateMarketAnalysis(
    title: string,
    description: string,
    technicalField: string
  ): Promise<{
    marketSize: number;
    growthRate: number;
    competitors: string[];
    targetIndustries: string[];
    monetizationStrategies: string[];
  }> {
    try {
      const prompt = `
        Generate a comprehensive market analysis for this patent:
        
        Title: ${title}
        Description: ${description.substring(0, 500)}... (truncated)
        Technical Field: ${technicalField}
        
        Provide the analysis in JSON format with the following structure:
        {
          "marketSize": <estimated market size in millions of dollars>,
          "growthRate": <annual growth rate percentage>,
          "competitors": [<list of key competitors or competing technologies>],
          "targetIndustries": [<list of industries that could benefit from this technology>],
          "monetizationStrategies": [<list of potential monetization strategies>]
        }
        
        Base your analysis on current market trends and the technical field of the patent.
      `;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      const response = completion.choices[0].message?.content || '';
      return JSON.parse(response);
    } catch (error) {
      console.error('Error generating market analysis:', error);
      
      // Return default market analysis
      return {
        marketSize: 100,
        growthRate: 8.5,
        competitors: ['Existing industry leaders', 'Similar technologies'],
        targetIndustries: ['Technology', 'Manufacturing', 'Healthcare'],
        monetizationStrategies: ['Licensing', 'Direct commercialization', 'Strategic partnerships']
      };
    }
  }

  /**
   * Generate technical classification for a patent
   */
  public static async generateTechnicalClassification(
    title: string,
    description: string,
    claims: string[]
  ): Promise<Array<{ category: string; confidence: number }>> {
    try {
      // Use BERT to classify the technical content
      const combinedText = `${title}. ${description}. ${claims.join(' ')}`;
      const classification = await BERTService.classifyText(combinedText);
      
      if (Array.isArray(classification) && classification.length > 0) {
        return classification.map(item => ({
          category: item.label,
          confidence: item.score
        }));
      }
      
      // If BERT classification fails, use GPT-4 as fallback
      const prompt = `
        Classify this patent into technical categories:
        
        Title: ${title}
        Description: ${description.substring(0, 500)}... (truncated)
        Claims: ${claims.slice(0, 3).join('\n')}... (truncated)
        
        Return the classification in JSON format with categories and confidence scores.
      `;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });
      
      const response = completion.choices[0].message?.content || '[]';
      return JSON.parse(response);
    } catch (error) {
      console.error('Error generating technical classification:', error);
      return [
        { category: 'Technology', confidence: 0.8 },
        { category: 'Innovation', confidence: 0.7 }
      ];
    }
  }
} 