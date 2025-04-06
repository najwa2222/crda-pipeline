const mysql = require('mysql2/promise');
const dbConfig = require('../db.config');

module.exports = async () => {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password
  });
  
  await connection.query(
    `DROP DATABASE IF EXISTS \`${dbConfig.database}_test\`;`
  );
  await connection.end();
};