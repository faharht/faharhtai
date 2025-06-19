import { GoogleGenerativeAI } from '@google/generative-ai';

export interface VictorAIResponse {
  response: string;
  corrections?: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  vocabularyTip?: {
    word: string;
    definition: string;
    examples: string[];
  };
  pronunciationTip?: {
    word: string;
    phonetic: string;
    tip: string;
  };
  followUpQuestion: string;
}

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  initialize(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async generateVictorAIResponse(userMessage: string, conversationHistory: string[] = []): Promise<VictorAIResponse> {
    if (!this.model) {
      throw new Error('Gemini AI not initialized. Please provide an API key.');
    }

    // Detect if the user message is in Russian (Cyrillic)
    const containsRussian = /[а-яА-ЯёЁ]/.test(userMessage);

    const prompt = `You are VictorAI, an advanced AI Russian language tutor. Analyze this message and provide a response in JSON format.

User message: "${userMessage}"

Previous conversation context: ${conversationHistory.slice(-4).join(' ')}

Respond as a friendly Russian tutor who:
${containsRussian ? '1. Corrects grammar/spelling mistakes in Russian' : '1. Do NOT correct grammar or spelling if the message is not in Russian.'}
2. Provides natural conversational responses in English
3. Teaches Russian vocabulary when appropriate
4. Gives pronunciation tips for difficult Russian words
5. Asks engaging follow-up questions to practice Russian

Return ONLY valid JSON in this exact format:
{
  "response": "Your natural, encouraging response to the user in English",
  "corrections": [{"original": "mistake", "corrected": "correction", "explanation": "why this is incorrect in Russian"}],
  "vocabularyTip": {"word": "russian_word", "definition": "meaning in English", "examples": ["example1 in Russian", "example2 in Russian"]},
  "pronunciationTip": {"word": "russian_word", "phonetic": "/pronunciation/", "tip": "how to pronounce this Russian word"},
  "followUpQuestion": "An engaging question to continue practicing Russian"
}

Only include corrections, vocabularyTip, and pronunciationTip if relevant. Always include response and followUpQuestion.`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      
      console.log('Gemini raw response:', responseText);
      
      // Clean the response to extract JSON
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Try to find JSON wrapped in code blocks
        jsonMatch = responseText.match(/```json\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          jsonMatch[0] = jsonMatch[1];
        }
      }
      
      if (!jsonMatch) {
        console.error('No JSON found in response:', responseText);
        throw new Error('Invalid response format from AI');
      }
      
      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      return {
        response: parsedResponse.response || "I'm here to help you learn Russian!",
        corrections: parsedResponse.corrections && parsedResponse.corrections.length > 0 ? parsedResponse.corrections : undefined,
        vocabularyTip: parsedResponse.vocabularyTip || undefined,
        pronunciationTip: parsedResponse.pronunciationTip || undefined,
        followUpQuestion: parsedResponse.followUpQuestion || "What Russian phrase would you like to learn?"
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      return {
        response: "I'm sorry, I had trouble processing that. Could you try again? I'm here to help you learn Russian!",
        followUpQuestion: "What Russian words or phrases would you like to practice today?"
      };
    }
  }

  async fetchWordData(word: string): Promise<{ phonetic: string, examples: string[], translation: string }> {
    if (!this.model) {
      throw new Error('Gemini AI not initialized. Please provide an API key.');
    }
    const prompt = `For the word: "${word}", return a JSON object with:
{
  "phonetic": "IPA transcription or best guess",
  "examples": ["example sentence 1 in this format: RUSSIAN SENTENCE (roman pronunciation - english translation)", "example sentence 2 in this format: RUSSIAN SENTENCE (roman pronunciation - english translation)"],
  "translation": "English translation of the word"
}
IMPORTANT: For each example, ALWAYS use this format:
RUSSIAN SENTENCE (roman pronunciation - english translation)
For example: Я люблю читать книги (Ya lyublyu chitat' knigi - I love to read books)
Only return valid JSON.`;
    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        jsonMatch = responseText.match(/```json\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          jsonMatch[0] = jsonMatch[1];
        }
      }
      if (!jsonMatch) {
        throw new Error('No JSON found in response: ' + responseText);
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        phonetic: parsed.phonetic || '',
        examples: parsed.examples || [],
        translation: parsed.translation || ''
      };
    } catch (error) {
      console.error('Gemini fetchWordData error:', error);
      return { phonetic: '', examples: [], translation: '' };
    }
  }
}

export const geminiService = new GeminiService();
