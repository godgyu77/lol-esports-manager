export default {
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
  },
};
