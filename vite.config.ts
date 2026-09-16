import fs from "node:fs"
import path from "node:path"
import { defineConfig, type Connect } from "vite"
import react from "@vitejs/plugin-react-swc"
import tailwindcss from "@tailwindcss/vite"

function missingWhisperModel(root: string): Connect.NextHandleFunction {
  const modelsRoot = path.resolve(root, "public", "models")
  return (req, res, next) => {
    const url = req.url?.split("?")[0]
    if (!url?.startsWith("/models/")) {
      next()
      return
    }

    const file = path.resolve(root, "public", decodeURIComponent(url.slice(1)))
    if (file !== modelsRoot && !file.startsWith(`${modelsRoot}${path.sep}`)) {
      res.statusCode = 403
      res.end("Forbidden")
      return
    }

    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.statusCode = 404
      res.end("Not found")
      return
    }

    next()
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: "whisper-models-404",
      configureServer(server) {
        server.middlewares.use(missingWhisperModel(server.config.root))
      },
      configurePreviewServer(server) {
        server.middlewares.use(missingWhisperModel(server.config.root))
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@convex": path.resolve(__dirname, "./convex"),
    },
  },
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  worker: {
    format: "es",
  },
})
