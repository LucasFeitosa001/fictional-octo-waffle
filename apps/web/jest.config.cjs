/** Jest config for unit tests of pure logic (agenda layout, formatters). */
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
};
