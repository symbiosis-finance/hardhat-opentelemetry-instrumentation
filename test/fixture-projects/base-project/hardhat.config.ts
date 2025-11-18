import { defineConfig } from 'hardhat/config'
import OpentelemetryInstrumentationPlugin from '../../../src/index.ts'

export default defineConfig({
  plugins: [OpentelemetryInstrumentationPlugin],
})
