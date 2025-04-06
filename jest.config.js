module.exports = {
  collectCoverage: true,
  coverageReporters: ['lcov', 'text', 'html'],
  reporters: ['default', 'jest-junit'],
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/public/',
    '/kubernetes/'
  ]
};