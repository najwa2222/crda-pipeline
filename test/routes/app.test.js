import request from 'supertest';
import app from '../../app.js';  // Note the .js extension
import mysql from 'mysql2';  // Import the MySQL library you're using
import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';

describe('Application Routes', () => {
  // Create a db connection for testing
  const db = mysql.createConnection({
    // Use test database credentials - consider using environment variables
    host: process.env.TEST_DB_HOST || 'localhost',
    user: process.env.TEST_DB_USER || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    database: process.env.TEST_DB_NAME || 'test_db'
  });

  beforeAll(async () => {
    // Setup test database connection if needed
    // Skip the temporary table creation if it's causing issues
  });

  afterAll(async () => {
    // Close the connection
    db.end();
  });

  test('GET /health should return 200 OK', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.text).toBe('OK');
  });

  test('GET / should render index page', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('Home');
  });

  // Add more route tests following this pattern
  jest.mock('mysql2');
  
});