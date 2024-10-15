// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // "@": resolve(__dirname, "./src"),
      "@": path.resolve(__dirname, "src"),
      // "@":"./src"
    }
  },
  plugins: [vue()],
  build: {
    outDir: "chatSDK", //打包文件夹
    minify: "esbuild", // esbuild 打包更快，但是不能去除 console.log，terser 打包慢，但能去除 console.log
    lib: {
      // entry: path.resolve(__dirname, 'src/sdk/index.ts'),
      entry: "./src/sdk/index.ts",
      name: "ChatSDK",
      formats: ["es", "umd", "cjs", "iife"], // 指定多种格式
      fileName: format => `ChatSDK.${format}.js`
    },
    sourcemap: true, // 启用 source map 生成
    rollupOptions: {
      // 确保外部化处理不打包依赖
      external: [],
      output: {
        globals: {
          // 这里可以指定依赖的全局变量，例如 vue: 'Vue'
        }
      }
    }
  }
});
