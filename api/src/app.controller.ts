import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  getApiInfo() {
    return {
      name: "CasaNova API",
      version: "1.0.0",
      description: "International mobility information aggregator",
      endpoints: {
        "/visa": "Visa requirements and procedures by country",
        "/job": "Job market information for foreigners",
        "/housing": "Housing/rental information for foreigners",
        "/healthcare": "Healthcare system information",
        "/banking": "Banking and financial services for expats",
        "/countries": "List of supported countries",
      },
    };
  }

  @Get("health")
  healthCheck() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
