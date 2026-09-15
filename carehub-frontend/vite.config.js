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
    // Test render nguyên trang (ExamConfig, ExamPaperList, QuestionBankList, DocumentQuestionJobReview...)
    // mất 1,5-2s mỗi test; chạy song song cả suite thì vượt mốc 5s mặc định và fail giả.
    testTimeout: 20000,
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
      reporter: ['text', 'html', 'lcov'],
      reportOnFailure: true,
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/test/**',
        'src/main.jsx',
      ],
    },
  },
})
