import { Body, Controller, Inject, Post } from "@nestjs/common";
import { GeminiGenerateContentDto } from "./dto/gemini-generate-content.dto.js";
import { GeminiService } from "./gemini.service.js";

@Controller("gemini")
export class GeminiController {
  constructor(@Inject(GeminiService) private readonly geminiService: GeminiService) {}

  @Post()
  create(@Body() createGeminiDto: GeminiGenerateContentDto) {
    return this.geminiService.generateContent(createGeminiDto);
  }
}
