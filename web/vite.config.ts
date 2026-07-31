import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

function readGitBuildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  base: '/RocketSimulator/',
  define: {
    __BUILD_ID__: JSON.stringify(readGitBuildId()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
