import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GPTPatentAnalysis {
  technicalComplexity: number;
  marketPotential: number;
  innovationScore: number;
  analysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    risks: string[];
  };
  recommendations: string[];
}

export class GPT4Service {
  private static async analyzeText(prompt: string): Promise<string> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      });

      return completion.choices[0].message?.content || '';
    } catch (error) {
      console.error('Error in GPT-4 analysis:', error);
      throw new Error('Failed to analyze patent with GPT-4');
    }
  }

  public static async analyzePatent(
    title: string,
    description: string,
    claims: string[]
  ): Promise<GPTPatentAnalysis> {
    const prompt = `
      Analyze this patent information:
      Title: ${title}
      Description: ${description}
      Claims: ${claims.join('\n')}

      Provide a comprehensive analysis including:
      1. Technical complexity (0-100)
      2. Market potential (0-100)
      3. Innovation score (0-100)
      4. SWOT analysis
      5. Specific recommendations for improvement

      Format the response as JSON with the following structure:
      {
        "technicalComplexity": number,
        "marketPotential": number,
        "innovationScore": number,
        "analysis": {
          "strengths": string[],
          "weaknesses": string[],
          "opportunities": string[],
          "risks": string[]
        },
        "recommendations": string[]
      }
    `;

    const response = await this.analyzeText(prompt);
    return JSON.parse(response);
  }

  public static async generateImprovedClaims(
    originalClaims: string[],
    priorArt: string[]
  ): Promise<string[]> {
    const prompt = `
      Original Patent Claims:
      ${originalClaims.join('\n')}

      Prior Art References:
      ${priorArt.join('\n')}

      Generate improved patent claims that:
      1. Differentiate from prior art
      2. Strengthen patent protection
      3. Address potential weaknesses
      4. Maintain clarity and enforceability

      Format each claim separately and maintain proper claim structure.
    `;

    const response = await this.analyzeText(prompt);
    return response.split('\n').filter(claim => claim.trim().length > 0);
  }

  public static async assessPatentability(
    invention: string,
    priorArt: string[]
  ): Promise<{
    score: number;
    analysis: string;
    recommendations: string[];
  }> {
    const prompt = `
      Analyze the patentability of this invention:
      ${invention}

      Prior Art:
      ${priorArt.join('\n')}

      Provide:
      1. Patentability score (0-100)
      2. Detailed analysis of novelty and non-obviousness
      3. Specific recommendations for improving patentability

      Format as JSON:
      {
        "score": number,
        "analysis": string,
        "recommendations": string[]
      }
    `;

    const response = await this.analyzeText(prompt);
    return JSON.parse(response);
  }

  public static async generateSearchStrategy(
    invention: string
  ): Promise<{
    keywords: string[];
    classifications: string[];
    searchQueries: string[];
  }> {
    const prompt = `
      Based on this invention:
      ${invention}

      Generate a comprehensive patent search strategy including:
      1. Key technical terms and synonyms
      2. Relevant IPC/CPC classifications
      3. Recommended search queries

      Format as JSON:
      {
        "keywords": string[],
        "classifications": string[],
        "searchQueries": string[]
      }
    `;

    const response = await this.analyzeText(prompt);
    return JSON.parse(response);
  }
}

export default GPT4Service; 