// Drops and recreates the public schema (and drizzle's migration schema) of SUPPORT_DATABASE_URL so a test run
// starts from an empty PostgreSQL database — PH-8.2 (BL-019). Refuses to touch anything but a database whose
// name ends in "_test", so a real database can never be wiped by a typo.
import { Client } from 'pg';

const url = process.env.SUPPORT_DATABASE_URL;
if (!url) {
  console.error('SUPPORT_DATABASE_URL is required, e.g. postgres://postgres:orbit@localhost:55433/orbit_test');
  process.exit(2);
}
const name = new URL(url).pathname.replace(/^\//, '');
if (!name.endsWith('_test')) {
  console.error(`Refusing to reset "${name}": only databases named *_test can be reset by this script.`);
  process.exit(2);
}
const client = new Client({ connectionString: url });
await client.connect();
await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
await client.query('DROP SCHEMA public CASCADE');
await client.query('CREATE SCHEMA public');
await client.end();
console.log(`pg-reset: ${name} is empty`);
