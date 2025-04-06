module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageReporters: ['lcov', 'text', 'html'],
  reporters: ['default', 'jest-junit'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  coverageDirectory: 'coverage',
  testResultsProcessor: 'jest-junit',
  transform: {
    "^.+\\.js$": "babel-jest"
  }
};
