import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      'app.fpthub.online',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    // scripts/l1-sync-status.py reads vitest-report.json to fill the Status column
    // of docs/l1-unit-tests/Frontend.csv.
    reporters: ['default', 'json'],
    outputFile: {
      json: './vitest-report.json',
    },
    coverage: {
      provider: 'v8',
      include: [
        'src/shared/api/**',
        'src/features/auth/utils/**',
        'src/features/auth/services/**',
        'src/features/auth/hooks/**',
        'src/features/training/utils/**',
      ],
    },
  },
})
