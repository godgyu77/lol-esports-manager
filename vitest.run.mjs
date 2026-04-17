export default {
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
  },
};
