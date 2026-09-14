import { defineConfig } from 'drizzle-kit';

// Generates SQL migrations into ./drizzle from the Drizzle schema (npm run db:generate -w api).
// No database credentials: migrations are applied programmatically at startup (src/database/database.ts).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
});
