const { PrismaClient } = require('@prisma/client');

let prisma;

function getPrismaInstance() {
  let dbUrl = process.env.DATABASE_URL || '';
  
  // On Vercel, force direct connection port 5432 to use the pooler port 6543 for Supabase
  if (process.env.VERCEL && dbUrl.includes('supabase.co:5432')) {
    console.log('[Prisma Client] Auto-redirecting Supabase URL to port 6543 connection pooler on Vercel');
    dbUrl = dbUrl.replace('supabase.co:5432', 'supabase.co:6543');
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
