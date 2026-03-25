import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateTechnicalExplanation = async (topic: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Explain the following networking concept in the context of Android VPN Injection: ${topic}. Be technical and concise.`,
  });
  return response.text;
};
