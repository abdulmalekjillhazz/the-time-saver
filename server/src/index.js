import 'dotenv/config';
import mongoose from 'mongoose';
import { loadEnv } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { configurePush } from './services/push.js';
import { startScheduler } from './services/scheduler.js';
import { initSentry } from './lib/sentry.js';

async function main() {
  // Throws with variable names only if configuration is wrong. The process then exits.
  const config = loadEnv();
  initSentry({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV });

  try {
    await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  } catch {
    // Never print the URI: it contains the database password.
    throw new Error('Database connection failed. Check MONGODB_URI and that the database is reachable.');
  }

  const server = createApp({ config }).listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'Smart Routine API started');
  });

  let stopScheduler = () => {};
  if (config.SCHEDULER_ENABLED) {
    const remindersEnabled = Boolean(config.VAPID_PUBLIC_KEY);
    if (remindersEnabled) configurePush(config);
    stopScheduler = startScheduler({
      enableReminders: remindersEnabled,
      trainingSecret: config.TRAINING_SECRET,
      config,
    });
    if (remindersEnabled) logger.info('reminder scheduler started');
    if (config.TRAINING_SECRET) logger.info('automatic model training scheduler started (at most once every 24 hours)');
    else logger.warn('automatic model training is off (TRAINING_SECRET is not set)');
    if (config.GEMINI_API_KEY || config.GROQ_API_KEY) {
      logger.info('midnight daily lesson generation is enabled with a curated fallback if AI is unavailable');
    } else {
      logger.warn('AI providers are not configured; midnight generation will publish the curated fallback lessons');
    }
    if (config.GEMINI_API_KEY) {
      logger.info('midnight Islamic reflection generation is enabled with Gemini');
    } else {
      logger.warn('daily Islamic reflections are off (GEMINI_API_KEY is not set)');
    }
  } else {
    logger.warn('scheduled tasks are off (SCHEDULER_ENABLED=false)');
  }
  if (!config.VAPID_PUBLIC_KEY) logger.warn('push reminders are off (VAPID keys not set)');

  const shutdown = async (signal) => {
    logger.info({ signal }, 'shutting down');
    stopScheduler();
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(`Startup failed: ${err.message}`);
  process.exit(1);
});
