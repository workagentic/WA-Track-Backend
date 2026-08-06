import { readFileSync } from 'fs';
import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Read directly from process.env, not ConfigService — NestFactory.create()
// needs httpsOptions before an app (and therefore a ConfigService) exists.
const httpsEnabled = process.env.HTTPS_ENABLED === 'true';
const httpsOptions = httpsEnabled
  ? {
      key: readFileSync(process.env.SSL_KEY_PATH!),
      cert: readFileSync(process.env.SSL_CERT_PATH!),
    }
  : undefined;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { httpsOptions });
  const config = app.get(ConfigService);

  const apiPrefix = config.get<string>('API_PREFIX', 'api/v1');
  // Health checks (load balancers, orchestrators) and API docs are
  // infrastructure/ops surfaces, not versioned API resources — they stay at
  // a fixed root path (/health, /docs) rather than moving if API_PREFIX
  // ever changes.
  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:3001');
  // The cors package only special-cases the bare string '*' as "allow any
  // origin" — passing ['*'] (what .split(',') gives for a single '*') is
  // treated as an allow-list containing the literal origin "*", which never
  // matches a real Origin header and silently omits the ACAO header entirely.
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips any property not defined in the DTO
      forbidNonWhitelisted: true, // throws 400 if an unknown property is sent
      transform: true, // converts query/path params to the declared types (e.g. string -> number)
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // Strips @Exclude()-marked fields (e.g. Employee.passwordHash) from every
  // response — necessary because several routes return TypeORM entities
  // directly, including nested employee objects inside tasks/time-entries/
  // device-sessions, rather than always going through a response DTO.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  if (config.get<boolean>('SWAGGER_ENABLED', true)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('TimeCamp API')
      .setDescription('Time tracking API for the web portal and desktop app')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(
    `TimeCamp API listening on ${httpsEnabled ? 'https' : 'http'}://localhost:${port} (prefix: /${apiPrefix})`,
  );
}
bootstrap();
