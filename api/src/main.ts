import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import "reflect-metadata";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set("query parser", "extended"); // See the Express v5 migration https://docs.nestjs.com/migration-guide
  app.setGlobalPrefix("api");

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  app.useBodyParser("json", { limit: "10mb" });

  const port = process.env.PORT || 5001;
  await app.listen(port);
  console.log(`CasaNova API running on http://localhost:${port}`);
}

bootstrap();
