// __mocks__/mysql2.js
export default {
    createConnection: jest.fn(() => ({
      promise: jest.fn(() => ({
        query: jest.fn().mockResolvedValue([{}, {}])
      })),
      end: jest.fn()
    }))
  };