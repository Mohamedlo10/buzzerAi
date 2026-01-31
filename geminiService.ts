
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateQuestions = async (categories: string[], questionsPerCategory: number) => {
  const prompt = `Génère exactement ${questionsPerCategory} questions de culture générale pour chacune des catégories suivantes : ${categories.join(', ')}.
  Les questions et les réponses DOIVENT être en français.
  Chaque question doit être stimulante et claire.
  Retourne le résultat sous forme d'un tableau d'objets JSON.`;

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
            category: { type: Type.STRING, description: "La catégorie de la question" },
            text: { type: Type.STRING, description: "Le texte de la question en français" },
            answer: { type: Type.STRING, description: "La réponse correcte en français" }
          },
          required: ["category", "text", "answer"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Erreur lors du parsing de la réponse Gemini", error);
    return [];
  }
};
