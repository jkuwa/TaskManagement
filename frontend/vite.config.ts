import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 開発サーバー（npm run dev）で /api から始まるリクエストを Spring Boot（8080番）へ転送する。
    // ブラウザから見ると通信先は同じ localhost:5173 になるので、CORS の設定がいらない。
    // ※ この転送は開発サーバーだけの機能。本番の配置を決めるときに改めて考える。
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
