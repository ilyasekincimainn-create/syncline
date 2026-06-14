const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/syncline?sslmode=disable';
  console.log('Running migrations on:', connectionString.replace(/:[^:]+@/, ':****@'));

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Check migrations dir
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Create a simple migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    for (const file of files) {
      const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
      if (rows.length > 0) {
        console.log(`Migration ${file} already applied.`);
        continue;
      }

      console.log(`Applying migration ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Successfully applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error in migration ${file}:`, err);
        throw err;
      }
    }
    console.log('All migrations completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
