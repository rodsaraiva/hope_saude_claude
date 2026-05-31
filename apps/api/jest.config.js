module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.tsx?$',
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/../test/'],
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true,
    }],
  },
  collectCoverageFrom: ['**/*.(t|j)sx?'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
