import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors(); // configure origins in production
  await app.listen(process.env.PORT || 3000);
  console.log(`Server running on ${await app.getUrl()}`);
}
bootstrap();