"use server";

import { GoogleGenAI } from "@google/genai";

// Initialize the client using the environment variable
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function askStudyAI(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
    });

    return { success: true, text: response.text };
  } catch (error) {
    console.error("AI Generation Error:", error);
    return { success: false, error: "Failed to generate AI response." };
  }
}
