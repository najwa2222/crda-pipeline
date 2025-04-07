export default {
  testEnvironment: 'node',
  transform: {
    "^.+\\.jsx?$": "babel-jest"
  },
  // Generate both JUnit reports
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results/',
      outputName: 'results.xml',
    }]
  ],
  // Configure coverage reporting
  collectCoverage: true,
  coverageDirectory: './coverage/',
  coverageReporters: ['text', 'lcov', 'cobertura'],
  // Handle ESM modules
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Set test match patterns
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  // Set timeout for tests
  testTimeout: 30000
};