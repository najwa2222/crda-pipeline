const mysql = require('mysql2/promise');
const dbConfig = require('../db.config');

module.exports = async () => {
  // Create test database if needed
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password
  });
  
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}_test\`;`
  );
  await connection.end();
  // test/setup.js
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
};