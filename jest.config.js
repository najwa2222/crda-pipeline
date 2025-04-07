export default {
  transform: {
    "^.+\\.jsx?$": "babel-jest"
  },
  testEnvironment: 'node',
  // Generate both JUnit and coverage reports
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
  // For ES modules support
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};