import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: 'react', replacement: path.resolve(process.cwd(), 'node_modules/react') },
      { find: 'react-dom', replacement: path.resolve(process.cwd(), 'node_modules/react-dom') },
      { find: 'lucide-react', replacement: path.resolve(process.cwd(), 'client/node_modules/lucide-react') },
    ],
  },
  test: {
    fileParallelism: false,
    include: ['server/tests/**/*.test.ts', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['dist/**', 'client/**', 'node_modules/**'],
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
});
