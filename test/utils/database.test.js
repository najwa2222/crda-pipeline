const mysql = require('mysql');
const dbConfig = require('../../db.config.test');

const testConnection = mysql.createConnection({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database
});

describe('Database Connection', () => {
  test('should connect to MySQL database', (done) => {
    testConnection.connect((err) => {
      expect(err).toBeNull();
      testConnection.end();
      done();
    });
  });
});