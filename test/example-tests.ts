import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import path from 'node:path'
import { createHardhatRuntimeEnvironment } from 'hardhat/hre'
import OpentelemetryInstrumentationPlugin from '../src/index.ts'
import { createFixtureProjectHRE } from './helpers/fixture-projects.js'

describe('MyPlugin tests', () => {
  describe('Test using a fixture project', async () => {
    it('Should define my-task', async () => {
      const hre = await createFixtureProjectHRE('base-project')

      const conn = await hre.network.connect()
      assert.equal(
        await conn.provider.request({ method: 'eth_blockNumber' }),
        '0x0',
        'The simulated chain is new, so it should be empty',
      )
    })
  })

  describe('Test creating a new HRE with an inline config', async () => {
    it('Should be able to load the plugin', async () => {
      // You can also create a new HRE without a fixture project, including
      // a custom config.
      //
      // In this case we don't provide a fixture project, nor a config path, just
      // a config object.
      //
      // You can customize the config object here, including adding new plugins.
      const hre = await createHardhatRuntimeEnvironment({
        plugins: [OpentelemetryInstrumentationPlugin],
        opentelemetryInstrumentation: {
          traceDevnets: true,
        },
      })

      assert.equal(hre.config.opentelemetryInstrumentation.traceDevnets, true)

      // The config path is undefined because we didn't provide it to
      // createHardhatRuntimeEnvironment. See its documentation for more info.
      assert.equal(hre.config.paths.config, undefined)

      // The root path is the directory containing the closest package.json to
      // the CWD, if none is provided.
      assert.equal(hre.config.paths.root, path.resolve(import.meta.dirname, '..'))
    })
  })
})
