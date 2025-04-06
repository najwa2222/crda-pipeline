export const testEnvironment = 'node';
export const collectCoverage = true;
export const coverageReporters = ['lcov', 'text', 'html'];
export const reporters = ['default', 'jest-junit'];
export const testMatch = ['**/?(*.)+(spec|test).[jt]s?(x)'];
export const coverageDirectory = 'coverage';
export const testResultsProcessor = 'jest-junit';
export const transform = {
  "^.+\\.js$": "babel-jest"
};
