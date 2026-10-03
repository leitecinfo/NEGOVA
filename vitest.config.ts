import { defineConfig } from "vitest/config";
import path from "path";
import fs from "fs";

// Load .env.local if present
try {
  const envPath = path.resolve(__dirname, ".env.local");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    envConfig.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...rest] = trimmed.split("=");
        const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    });
  }
} catch {
  // Ignore env loading errors
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 20000,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: [".agents/**", "node_modules/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
