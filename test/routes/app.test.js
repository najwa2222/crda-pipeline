const request = require('supertest');
const app = require('../../app');
const db = require('../../db');

describe('Application Routes', () => {
  beforeAll(async () => {
    // Setup test database connection
    await db.promise().query(`
      CREATE TEMPORARY TABLE services_utilisateur LIKE services_utilisateur;
    `);
  });

  afterAll(async () => {
    await db.end();
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
});