'use strict';

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required.');
}

const poolConfig = { connectionString };

try {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get('sslmode');
  if (sslMode === 'require' || process.env.PGSSLMODE === 'require') {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
} catch (error) {
  console.error('Invalid DATABASE_URL:', error.message);
}

const pool = new Pool(poolConfig);

module.exports = pool;
