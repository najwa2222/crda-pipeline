// __tests__/app.test.js
import request from 'supertest';
import app from '../app'; // Adjust path as needed

describe('GET /health', () => {
  it('should return 200 OK when DB connection is healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toEqual('OK');
  });
});
