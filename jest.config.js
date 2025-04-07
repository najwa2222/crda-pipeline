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
      includeConsoleOutput: true,
      reportedFilePath: 'relative'
    }],
    ['jest-html-reporter', {
      outputPath: './test-results/test-report.html'
    }]
  ],
  collectCoverage: true,
  coverageDirectory: './coverage/',
  coverageReporters: ['html', 'lcov', 'cobertura', 'text'],
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  globalSetup: '<rootDir>/test/setup.js',
  globalTeardown: '<rootDir>/test/teardown.js'
};