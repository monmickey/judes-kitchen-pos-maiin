const fs = require('fs');
const path = require('path');

function prepareSchema(schemaPath) {
  if (!fs.existsSync(schemaPath)) {
    console.log(`Schema file not found at ${schemaPath}, skipping.`);
    return;
  }

  console.log(`Preparing schema: ${schemaPath}`);
  let content = fs.readFileSync(schemaPath, 'utf8');

  // Check if we are running in Vercel or production deployment
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true' || process.env.NODE_ENV === 'production';

  if (isVercel) {
    console.log('Detected Vercel/Production environment. Configuring schema for PostgreSQL...');
    // Replace SQLite datasource with PostgreSQL
    content = content.replace(
      /datasource\s+db\s*{[^}]*}/g,
      `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
}`
    );
  } else {
    console.log('Detected local/development environment. Ensuring schema is configured for SQLite...');
    // Ensure SQLite datasource is configured
    content = content.replace(
      /datasource\s+db\s*{[^}]*}/g,
      `datasource db {
  provider  = "sqlite"
  url       = "file:./dev.db"
}`
    );
  }

  fs.writeFileSync(schemaPath, content, 'utf8');
  console.log(`Schema prepared successfully.`);
}

// Run for both schema files in the project
const rootSchemaPath = path.join(__dirname, '../prisma/schema.prisma');
const secondarySchemaPath = path.join(__dirname, '../database/schema/schema.prisma');

prepareSchema(rootSchemaPath);
prepareSchema(secondarySchemaPath);
