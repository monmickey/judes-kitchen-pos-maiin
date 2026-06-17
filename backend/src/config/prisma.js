const { PrismaClient } = require('@prisma/client');

let prisma;

function getPrismaInstance() {
  const dbUrl = process.env.DATABASE_URL || '';
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
