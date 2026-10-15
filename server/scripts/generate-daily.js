import 'dotenv/config';
import mongoose from 'mongoose';
import { generateDailyLesson } from '../src/services/dailyLesson.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart-routine-dev';
const config = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
};

if (!config.GEMINI_API_KEY && !config.GROQ_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY is not set in server/.env file.');
  console.error('Please add GEMINI_API_KEY=your_key to server/.env and try again.');
  process.exit(1);
}

await mongoose.connect(mongoUri);
console.log('Connected to MongoDB. Generating one English daily lesson...');

const today = new Date().toISOString().slice(0, 10);

try {
  const result = await generateDailyLesson({ date: today, locale: 'en', config, force: true });
  console.log(`✅ English lesson created: "${result.dailyLesson.title}" (slug: ${result.dailyLesson.slug})`);
  console.log('\n🎉 Successfully created one English story and saved it to the database!');
} catch (err) {
  console.error('Generation failed:', err.message);
} finally {
  await mongoose.disconnect();
}
