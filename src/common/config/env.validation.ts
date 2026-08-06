import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  CORS_ORIGIN: Joi.string().default('http://localhost:3001'),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  BCRYPT_SALT_ROUNDS: Joi.number().default(12),
  PAIRING_CODE_TTL_MINUTES: Joi.number().default(10),
  PAIRING_POLL_INTERVAL_SECONDS: Joi.number().default(5),
  SWAGGER_ENABLED: Joi.boolean().default(true),

  HTTPS_ENABLED: Joi.boolean().default(false),
  SSL_KEY_PATH: Joi.string().when('HTTPS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.optional() }),
  SSL_CERT_PATH: Joi.string().when('HTTPS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.optional() }),

  SEED_ADMIN_EMAIL: Joi.string()
    .email({ tlds: { allow: false } })
    .default('admin@timecamp.local'),
  SEED_ADMIN_PASSWORD: Joi.string().default('ChangeMe123!'),
});
