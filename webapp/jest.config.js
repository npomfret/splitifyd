module.exports = {
  testMatch: ['<rootDir>/src/js/**/*.test.ts', '<rootDir>/src/js/**/*.test.js'],
  transform: {
    '^.+\.ts$': 'ts-jest',
    '^.+\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transformIgnorePatterns: [
    '<rootDir>/node_modules/',
  ],
  moduleNameMapper: {
    '^(.+)\\.js$': '$1'
  }
};
