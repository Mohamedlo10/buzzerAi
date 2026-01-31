
import { GoogleGenAI, Type } from "@google/genai";
import { PlayerCategory } from "./types";

// Always use the API key directly from process.env.API_KEY using named parameter.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateQuestions = async (categories: PlayerCategory[], questionsPerCategory: number) => {
  const categoryDetails = categories.map(c => `${c.name} (Niveau: ${c.difficulty})`).join(', ');
  
  const prompt = `Génère exactement ${questionsPerCategory} questions de culture générale pour chacune des rubriques suivantes en respectant leur niveau de difficulté : ${categoryDetails}.
  Les questions et les réponses DOIVENT être en français.
  Chaque question doit être stimulante, précise et adaptée au niveau de difficulté indiqué.
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

  try {
    // Access response.text as a property (not a method).
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Erreur lors du parsing de la réponse Gemini", error);
    return [];
  }
};
