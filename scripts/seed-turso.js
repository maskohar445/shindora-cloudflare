#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

async function seedTurso() {
  const url = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN;

  console.log('==============================================');
  console.log('       ShinDora Nesub - Turso DB Seeder       ');
  console.log('==============================================');

  if (!url) {
    console.error('Error: TURSO_DATABASE_URL environment variable is not defined.');
    console.log('Usage:');
    console.log('  TURSO_DATABASE_URL="libsql://your-db.turso.io" TURSO_AUTH_TOKEN="your-token" node scripts/seed-turso.js');
    process.exit(1);
  }

  console.log(`Connecting to Turso: ${url}...`);
  const client = createClient({ url, authToken });

  const sqlFilePath = path.join(__dirname, '..', 'turso_init.sql');
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`Error: ${sqlFilePath} not found!`);
    process.exit(1);
  }

  console.log('Reading turso_init.sql...');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  // Parse SQL statements
  const statements = sqlContent
    .split(';\n')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Total statements to execute: ${statements.length}`);

  let successCount = 0;
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await client.execute(stmt);
      successCount++;
      if ((i + 1) % 25 === 0 || i === statements.length - 1) {
        console.log(`Executed [${i + 1}/${statements.length}] statements successfully...`);
      }
    } catch (err) {
      console.warn(`[Warning on stmt ${i + 1}]: ${err.message}`);
    }
  }

  console.log('----------------------------------------------');
  console.log(`Seeding complete! ${successCount} statements successfully committed.`);
  console.log('==============================================');
}

seedTurso().catch(err => {
  console.error('Fatal error during seeding:', err);
  process.exit(1);
});
