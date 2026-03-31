import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { RedisIoAdapter } from "./adapters/redis-io.adapter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:5173"],
    credentials: true,
  });

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const redisAdapter = new RedisIoAdapter(app);
    await redisAdapter.connectToRedis(redisUrl);
    app.useWebSocketAdapter(redisAdapter);
  }

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

bootstrap();
