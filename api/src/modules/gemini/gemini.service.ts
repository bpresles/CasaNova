import { GoogleGenAI } from "@google/genai";
import { Injectable } from "@nestjs/common";
import { GeminiGenerateContentDto } from "./dto/gemini-generate-content.dto.js";

@Injectable()
export class GeminiService {
  getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("API Key not found");
      throw new Error("API Key is missing");
    }
    return new GoogleGenAI({ apiKey: apiKey });
  };

  async generateContent(dto: GeminiGenerateContentDto) {
    const ai = this.getAI();

    const response = await ai.models.generateContent(dto.parameters);
    return response.text;
  }
}
