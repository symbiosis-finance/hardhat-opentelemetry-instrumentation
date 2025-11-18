import { describe, it } from 'node:test'

import assert from 'node:assert/strict'
import { HardhatConfig, HardhatUserConfig } from 'hardhat/types/config'
import { resolvePluginConfig, validatePluginConfig } from '../src/config.ts'
import { OpentelemetryInstrumentationConfig } from '../src/types.ts'

describe('OpentelemetryInstrumentation config', () => {
  describe('Config validation', () => {
    describe('Valid cases', () => {
      it('Should consider an empty config as valid', async () => {
        const validationErrors = await validatePluginConfig({})

        assert.equal(validationErrors.length, 0)
      })

      it('Should ignore errors in other parts of the config', async () => {
        const validationErrors = await validatePluginConfig({
          networks: {
            foo: {
              type: 'http',
              url: 'INVALID URL',
            },
          },
        })

        assert.equal(validationErrors.length, 0)
      })

      it('Should accept an empty config object', async () => {
        const validationErrors = await validatePluginConfig({
          opentelemetryInstrumentation: {},
        })

        assert.equal(validationErrors.length, 0)
      })

      it('Should accept an non-empty config', async () => {
        const validationErrors = await validatePluginConfig({
          opentelemetryInstrumentation: {
            traceDevnets: false,
          },
        })

        assert.equal(validationErrors.length, 0)
      })
    })

    describe('Invalid cases', () => {
      // Many invalid cases are type-unsafe, as we have to trick TypeScript into
      // allowing something that is invalid
      it('Should reject a myConfig field with an invalid type', async () => {
        const validationErrors = await validatePluginConfig({
          opentelemetryInstrumentation: 'INVALID' as unknown as OpentelemetryInstrumentationConfig,
        })

        assert.deepEqual(validationErrors, [
          {
            path: ['opentelemetryInstrumentation'],
            message: 'Expected an object with an optional greeting.',
          },
        ])
      })

      it('Should reject a config field with an invalid greeting', async () => {
        const validationErrors = await validatePluginConfig({
          opentelemetryInstrumentation: {
            traceDevnets: 123 as unknown as boolean,
          },
        })

        assert.deepEqual(validationErrors, [
          {
            path: ['opentelemetryInstrumentation', 'traceDevnets'],
            message: 'Expected a boolean.',
          },
        ])
      })
    })
  })

  describe('Config resolution', () => {
    // The config resolution is always type-unsafe, as your plugin is extending
    // the HardhatConfig type, but the partially resolved config isn't aware of
    // your plugin's extensions. You are responsible for ensuring that they are
    // defined correctly during the resolution process.
    //
    // We recommend testing using an artificial partially resolved config, as
    // we do here, but taking care that the fields that your resolution logic
    // depends on are defined and valid.

    it('Should resolve a config without a opentelemetryInstrumentation field', async () => {
      const userConfig: HardhatUserConfig = {}
      const partiallyResolvedConfig = {} as HardhatConfig

      const resolvedConfig = await resolvePluginConfig(userConfig, partiallyResolvedConfig)

      assert.deepEqual(resolvedConfig.opentelemetryInstrumentation, { traceDevnets: false })
    })

    it('Should resolve a config with an empty opentelemetryInstrumentation field', async () => {
      const userConfig: HardhatUserConfig = { opentelemetryInstrumentation: {} }
      const partiallyResolvedConfig = {} as HardhatConfig

      const resolvedConfig = await resolvePluginConfig(userConfig, partiallyResolvedConfig)

      assert.deepEqual(resolvedConfig.opentelemetryInstrumentation, { traceDevnets: false })
    })

    it('Should resolve a config using the provided config', async () => {
      const userConfig: HardhatUserConfig = { opentelemetryInstrumentation: { traceDevnets: true } }
      const partiallyResolvedConfig = {} as HardhatConfig

      const resolvedConfig = await resolvePluginConfig(userConfig, partiallyResolvedConfig)

      assert.deepEqual(resolvedConfig.opentelemetryInstrumentation, { traceDevnets: true })
    })
  })
})
