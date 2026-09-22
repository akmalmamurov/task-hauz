import { defineConfig } from 'vite'

import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'

import viteReact from '@vitejs/plugin-react'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // Nitro is what turns the built fetch handler into something a host can run.
  // It reads the host from the environment, so the same build produces a plain
  // Node server locally and Vercel's function output on Vercel, with no
  // per-host configuration here. The order matters: Start, then Nitro, then
  // React.
  plugins: [tailwindcss(), tanstackStart(), nitro(), viteReact()],
})

export default config
