module.exports = {
  testMatch: ['<rootDir>/src/js/**/*.test.js'],
  transform: {
    '^.+\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['js', 'json', 'node'],
  transformIgnorePatterns: [
    '<rootDir>/node_modules/',
  ],
};
