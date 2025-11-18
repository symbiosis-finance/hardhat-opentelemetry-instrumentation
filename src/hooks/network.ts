import type { HookContext, NetworkHooks } from 'hardhat/types/hooks'
import { ChainType, NetworkConnection } from 'hardhat/types/network'
import { Attributes, Span, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { FailedJsonRpcResponse, JsonRpcRequest, JsonRpcResponse } from 'hardhat/types/providers'
import { ResponseStatusCodeError } from '@nomicfoundation/hardhat-utils/request'
import {
  ATTR_HARDHAT_CHAIN_TYPE,
  ATTR_HARDHAT_CONNECTION_ID,
  ATTR_HARDHAT_NETWORK_NAME,
  ATTR_RPC_JSONRPC_ERROR,
  ATTR_RPC_JSONRPC_ERROR_CODE,
  ATTR_RPC_JSONRPC_ERROR_MESSAGE,
  ATTR_RPC_JSONRPC_REQUEST_ID,
  ATTR_RPC_JSONRPC_VERSION,
  ATTR_RPC_METHOD,
  ATTR_RPC_SERVICE,
  ATTR_RPC_SYSTEM,
  requestParam,
} from './semconv.ts'

export default async (): Promise<Partial<NetworkHooks>> => {
  const handlers: Partial<NetworkHooks> = {
    async newConnection<ChainTypeT extends ChainType | string>(
      context: HookContext,
      next: (nextContext: HookContext) => Promise<NetworkConnection<ChainTypeT>>,
    ): Promise<NetworkConnection<ChainTypeT>> {
      const tracer = trace.getTracer('depository')
      return await tracer.startActiveSpan('hardhat.evm-connect', {}, async (span: Span) => {
        try {
          const connection = await next(context)
          span.setStatus({ code: SpanStatusCode.OK })
          span.setAttributes({
            [ATTR_HARDHAT_CHAIN_TYPE]: connection.chainType,
            [ATTR_HARDHAT_CONNECTION_ID]: connection.id,
            [ATTR_HARDHAT_NETWORK_NAME]: connection.networkName,
          })
          return connection
        } catch (err) {
          span.setStatus({ code: SpanStatusCode.ERROR })
          throw err
        } finally {
          span.end()
        }
      })
    },
    async onRequest<ChainTypeT extends ChainType | string>(
      context: HookContext,
      networkConnection: NetworkConnection<ChainTypeT>,
      jsonRpcRequest: JsonRpcRequest,
      next: (
        nextContext: HookContext,
        nextNetworkConnection: NetworkConnection<ChainTypeT>,
        nextJsonRpcRequest: JsonRpcRequest,
      ) => Promise<JsonRpcResponse>,
    ): Promise<JsonRpcResponse> {
      const rpcMethod = jsonRpcRequest.method
      if (!shouldTrace(context, rpcMethod)) return next(context, networkConnection, jsonRpcRequest)
      const tracer = trace.getTracer('depository')
      // Create a span with RPC semantic conventions - following the format $package.$service/$method
      const spanName = `hardhat.evm-jsonrpc/${rpcMethod}`
      const attributes = {
        [ATTR_RPC_SYSTEM]: 'jsonrpc',
        [ATTR_RPC_SERVICE]: 'evm-jsonrpc',
        [ATTR_RPC_METHOD]: rpcMethod,
        [ATTR_RPC_JSONRPC_VERSION]: '2.0',
        [ATTR_RPC_JSONRPC_REQUEST_ID]: jsonRpcRequest.id,
        [ATTR_HARDHAT_CONNECTION_ID]: networkConnection.id,
        [ATTR_HARDHAT_NETWORK_NAME]: networkConnection.networkName,
        ...gatherAdditionalAttributesFromRpcCall(jsonRpcRequest),
      }
      if (networkConnection.networkConfig.chainId)
        attributes[ATTR_HARDHAT_NETWORK_NAME] = networkConnection.networkConfig.chainId.toString()
      return await tracer.startActiveSpan(
        spanName,
        {
          kind: SpanKind.CLIENT,
          attributes,
        },
        async (span: Span) => {
          try {
            const result = await next(context, networkConnection, jsonRpcRequest)
            span.setStatus({ code: SpanStatusCode.OK })
            return result
          } catch (err) {
            span.setStatus({ code: SpanStatusCode.ERROR })
            if (err instanceof Error) {
              const rootCause = extractRootCause(err)
              span.recordException(rootCause)
              if (rootCause instanceof ResponseStatusCodeError) {
                span.setAttributes(exractFailedJsonRpcResponseAttrs(rootCause.body as FailedJsonRpcResponse))
              }
            } else if (typeof err === 'string') span.recordException(err)
            else span.addEvent('exception', { [ATTR_RPC_JSONRPC_ERROR]: String(err) })
            throw err
          } finally {
            span.end()
          }
        },
      )
    },
  }

  return handlers
}

// Filter out devnet calls.
function shouldTrace(context: HookContext, rpcMethod: string): boolean {
  return (
    !(rpcMethod === 'hardhat_metadata' || rpcMethod === 'anvil_nodeInfo') ||
    context.config.opentelemetryInstrumentation.traceDevnets ||
    context.userConfig.opentelemetryInstrumentation?.traceDevnets ||
    false
  )
}

function exractFailedJsonRpcResponseAttrs(resp: FailedJsonRpcResponse): Attributes {
  return {
    [ATTR_RPC_JSONRPC_ERROR_CODE]: resp.error.code,
    [ATTR_RPC_JSONRPC_ERROR_MESSAGE]: resp.error.message,
  }
}

// Returns ResponseStatusCodeError or innermost cause.
function extractRootCause(err: Error): Error {
  while (true) {
    if (err instanceof ResponseStatusCodeError) break
    if (!(err.cause instanceof Error)) break
    err = err.cause
  }
  return err
}

// Extract params for known RPC methods.
function gatherAdditionalAttributesFromRpcCall(request: JsonRpcRequest): Attributes {
  switch (request.method) {
    case 'eth_getBalance': {
      const params = request.params as [string, string]
      return {
        [requestParam('address')]: params[0],
        [requestParam('blockNumber')]: params[1],
      }
    }
    case 'eth_getLogs': {
      const params = request.params as [{ address: string; fromBlock: string; toBlock: string; topics: string[] }]
      return {
        [requestParam('address')]: params[0].address,
        [requestParam('fromBlock')]: params[0].fromBlock,
        [requestParam('toBlock')]: params[0].toBlock,
        [requestParam('topics')]: params[0].topics,
      }
    }
    case 'eth_call': {
      const params = request.params as [{ to: string; from: string }, string]
      return {
        [requestParam('to')]: params[0].to,
        [requestParam('from')]: params[0].from,
        [requestParam('blockNumber')]: params[1],
      }
    }
    default:
      return {}
  }
}
