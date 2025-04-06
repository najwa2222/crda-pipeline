export default {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageReporters: ['lcov', 'text', 'html'],
  reporters: ['default', 'jest-junit'],
  testMatch: ['test/**/*.test.js'],
  coverageDirectory: 'coverage',
  testResultsProcessor: 'jest-junit'
};
