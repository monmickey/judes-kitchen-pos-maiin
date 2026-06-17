const { PrismaClient } = require('@prisma/client');

let prisma;

function getPrismaInstance() {
  let dbUrl = process.env.DATABASE_URL || '';
  
  // On Vercel, force direct connection port 5432 to use the IPv4-reachable regional pooler port 6543 for Supabase
  if (process.env.VERCEL && dbUrl.includes('.supabase.co')) {
    const projectRefMatch = dbUrl.match(/db\.([^.]+)\.supabase\.co/);
    const authMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@/);
    if (projectRefMatch && authMatch) {
      const projectRef = projectRefMatch[1];
      const password = authMatch[2];
      console.log(`[Prisma Client] Auto-redirecting Supabase URL for project ${projectRef} to regional pooler aws-1-ap-northeast-1 on Vercel`);
      dbUrl = `postgresql://postgres.${projectRef}:${password}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&statement_cache_size=0`;
    }
  }
  
  let connectionUrl = dbUrl;
  const clientConfig = {};
  
  if (connectionUrl) {
    // If using the Supabase pooled connection on port 6543, ensure pooling parameters are appended
    if (dbUrl.includes(':6543') && !dbUrl.includes('statement_cache_size=')) {
      connectionUrl = dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'statement_cache_size=0&pgbouncer=true';
    }
    clientConfig.datasources = {
      db: { url: connectionUrl }
    };
  }
  
  return new PrismaClient(clientConfig);
}

if (process.env.NODE_ENV === 'production') {
  if (!global.prisma) {
    global.prisma = getPrismaInstance();
  }
  prisma = global.prisma;
} else {
  if (!global.prisma) {
    global.prisma = getPrismaInstance();
  }
  prisma = global.prisma;
}

module.exports = prisma;
