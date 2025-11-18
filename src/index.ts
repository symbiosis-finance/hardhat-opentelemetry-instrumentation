import type { HardhatPlugin } from 'hardhat/types/plugins'

import './type-extensions.js'

const plugin: HardhatPlugin = {
  id: 'hardhat-opentelemetry-instrumentation',
  hookHandlers: {
    config: () => import('./hooks/config.js'),
    network: () => import('./hooks/network.js'),
  },
}

export default plugin
