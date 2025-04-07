module.exports = {
  testEnvironment: 'node',
  reporters: [
    "default",
    [ "jest-junit", { 
        outputDirectory: "test-results", 
        outputName: "jest-junit.xml" 
      } 
    ]
  ],
  coverageDirectory: "coverage",
  collectCoverage: true,
  coverageReporters: ["lcov", "text"]
};
