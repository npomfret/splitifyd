module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
    moduleNameMapping: {
        '^@shared/(.*)$': '<rootDir>/../firebase/functions/src/shared/$1',
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    transform: {
        '^.+\\.(ts|tsx)$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.json',
                jsx: 'react-jsx',
                jsxImportSource: 'preact',
            },
        ],
    },
    testMatch: ['<rootDir>/src/**/__tests__/**/*.(ts|tsx|js)', '<rootDir>/src/**/*.(test|spec).(ts|tsx|js)'],
    collectCoverageFrom: ['src/**/*.(ts|tsx)', '!src/**/*.d.ts', '!src/main.tsx', '!src/vite-env.d.ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
};
