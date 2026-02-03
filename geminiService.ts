
import { GoogleGenAI, Type } from "@google/genai";
import { PlayerCategory } from "./types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Fonction utilitaire pour attendre
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fonction de retry avec backoff exponentiel
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 5000
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Vérifier si c'est une erreur 429 (rate limit)
      const isRateLimitError =
        error?.message?.includes('429') ||
        error?.message?.includes('RESOURCE_EXHAUSTED') ||
        error?.message?.includes('quota');

      if (isRateLimitError && attempt < maxRetries) {
        // Extraire le délai suggéré ou utiliser un backoff exponentiel
        const retryMatch = error?.message?.match(/retry in (\d+\.?\d*)/i);
        const suggestedDelay = retryMatch ? parseFloat(retryMatch[1]) * 1000 : null;
        const delay = suggestedDelay || baseDelay * Math.pow(2, attempt);

        console.log(`Rate limit atteint. Nouvelle tentative dans ${Math.round(delay/1000)}s... (${attempt + 1}/${maxRetries})`);
        await sleep(delay);
      } else if (!isRateLimitError) {
        // Si ce n'est pas une erreur de rate limit, on arrête les retry
        throw error;
      }
    }
  }

  throw lastError || new Error('Echec après plusieurs tentatives');
};

export const generateQuestions = async (categories: PlayerCategory[], questionsPerCategory: number) => {
  const categoryDetails = categories.map(c => `${c.name} (Niveau: ${c.difficulty})`).join(', ');

  const prompt = `Génère exactement ${questionsPerCategory} questions de culture générale pour chacune des rubriques suivantes en respectant leur niveau de difficulté : ${categoryDetails}.
  Les questions et les réponses DOIVENT être en français.
  Chaque question doit être stimulante, précise et adaptée au niveau de difficulté indiqué.
  Retourne le résultat sous forme d'un tableau d'objets JSON.`;

  const generateContent = async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, description: "La rubrique de la question" },
              difficulty: { type: Type.STRING, description: "Le niveau de difficulté respecté" },
              text: { type: Type.STRING, description: "Le texte de la question en français" },
              answer: { type: Type.STRING, description: "La réponse correcte en français" }
            },
            required: ["category", "text", "answer", "difficulty"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  };

  try {
    return await retryWithBackoff(generateContent, 3, 5000);
  } catch (error: any) {
    console.error("Erreur lors de la génération des questions:", error);

    // Message d'erreur plus convivial
    if (error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error('Quota API dépassé. Veuillez attendre quelques secondes et réessayer.');
    }

    throw error;
  }
};
