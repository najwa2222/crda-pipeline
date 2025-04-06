module.exports = {
    coverageDirectory: 'coverage',
    collectCoverageFrom: ['**/*.js'],
    coverageReporters: ['lcov', 'cobertura'],
    reporters: [
      'default',
      ['jest-junit', { outputDirectory: 'test-results', outputName: 'test-report.xml' }]
  };