import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** GitHub Pages serves this repo at https://erdtheturd.github.io/investor/ */
const BASE = '/investor/'

function yahooProxyPlugin(): Plugin {
  const handler = async (req: { url?: string; method?: string }, res: {
    statusCode: number
    setHeader: (k: string, v: string) => void
    end: (b?: string) => void
  }, next: () => void) => {
    const url = req.url || ''
    if (!url.startsWith('/api/yahoo')) return next()
    const target = 'https://query2.finance.yahoo.com' + url.replace(/^\/api\/yahoo/, '')
    try {
      const upstream = await fetch(target, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })
      const body = await upstream.text()
      res.statusCode = upstream.status
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
      res.end(body)
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: String(err) }))
    }
  }

  return {
    name: 'dunn-yahoo-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handler(req, res, next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handler(req, res, next)
      })
    },
  }
}

/** Keyless LLM proxy — strips auth so shared egress IPs don't inherit a dead Pollinations key. */
function aiProxyPlugin(): Plugin {
  const handler = async (req: {
    url?: string
    method?: string
    on: (e: string, cb: (c: Buffer) => void) => void
  }, res: {
    statusCode: number
    setHeader: (k: string, v: string) => void
    end: (b?: string) => void
  }, next: () => void) => {
    const url = req.url || ''
    if (!url.startsWith('/api/ai/chat') || req.method !== 'POST') return next()

    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      void (async () => {
        try {
          const payload = Buffer.concat(chunks).toString('utf8')
          const models = ['openai-fast', 'openai']
          let lastStatus = 502
          let lastBody = '{"error":"all models failed"}'
          let parsed: Record<string, unknown> = {}
          try {
            parsed = JSON.parse(payload) as Record<string, unknown>
          } catch {
            /* keep empty */
          }
          for (const model of models) {
            const body = JSON.stringify({
              ...parsed,
              model,
            })
            const upstream = await fetch('https://text.pollinations.ai/openai', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: '',
                'User-Agent': 'DunnInvesting/1.0',
              },
              body,
            })
            const text = await upstream.text()
            lastStatus = upstream.status
            lastBody = text
            if (upstream.ok) {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(text)
              return
            }
          }
          res.statusCode = lastStatus
          res.setHeader('Content-Type', 'application/json')
          res.end(lastBody)
        } catch (err) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: String(err) }))
        }
      })()
    })
  }

  return {
    name: 'dunn-ai-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handler(req, res, next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handler(req, res, next)
      })
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [react(), yahooProxyPlugin(), aiProxyPlugin()],
  build: {
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !dep.includes('web-llm') && !dep.includes('webllm')),
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@mlc-ai/web-llm')) return 'webllm'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react'
          if (id.includes('react-router')) return 'router'
        },
      },
    },
  },
})
