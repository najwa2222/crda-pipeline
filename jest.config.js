// jest.config.js
export default {
  testEnvironment: 'node',
  transform: {
    "^.+\\.jsx?$": "babel-jest"
  },
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results/',
      outputName: 'results.xml',
      includeConsoleOutput: true,  // Recommended for CI
      reportedFilePath: 'relative' // Better path handling
    }]
  ],
  collectCoverage: true,
  coverageDirectory: './coverage/',
  coverageReporters: ['text', 'lcov', 'cobertura', 'html'],
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  testTimeout: 30000,
  // Add these for better CI performance
  cache: false,
  maxWorkers: 4,
  detectOpenHandles: true
};