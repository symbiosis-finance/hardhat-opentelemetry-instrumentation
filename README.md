# `hardhat-opentelemetry-instrumentation`

This plugin adds RPC request tracing using OpenTelemetry.

## Installation

To install this plugin, run the following command:

```bash
npm install --save-dev hardhat-opentelemetry-instrumentation
```

In your `hardhat.config.ts` file, import the plugin and add it to the `plugins` array:

```ts
import opentelemetryInstrumentationPlugin from "hardhat-opentelemetry-instrumentation";

export default defineConfig({
  plugins: [opentelemetryInstrumentationPlugin],
  //...
});
```
