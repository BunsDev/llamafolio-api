import '@lib/providers'

import type { BaseContext } from '@lib/adapter'
import type { Chain } from '@lib/chains'
import { chains } from '@lib/chains'
import { providers } from '@lib/providers'
import type { Abi, AbiFunction } from 'abitype'
import type { DecodeFunctionResultParameters, DecodeFunctionResultReturnType } from 'viem'
import { isAddress } from 'viem'

// Merge incoming calls/multicalls and dispatch results as viem doesn't currently support it
class BatchCaller {
  _pendingBatchAggregator: NodeJS.Timer | null = null
  _pendingBatch: Array<{
    request: MultiCallParams
    resolve: (result: any) => void
    reject: (error: Error) => void
  }> | null = null
  _chain: Chain

  constructor(chain: Chain) {
    this._chain = chain
  }

  call(request: MultiCallParams) {
    if (this._pendingBatch == null) {
      this._pendingBatch = []
    }

    const inflightRequest: any = { request, resolve: null, reject: null }

    const promise = new Promise((resolve, reject) => {
      inflightRequest.resolve = resolve
      inflightRequest.reject = reject
    })

    this._pendingBatch.push(inflightRequest)

    if (!this._pendingBatchAggregator) {
      // Schedule batch for next event loop + short duration
      this._pendingBatchAggregator = setTimeout(async () => {
        // Get the current batch and clear it, so new requests
        // go into the next batch
        const batch = Array.from(this._pendingBatch || [])
        this._pendingBatch = null
        this._pendingBatchAggregator = null

        // next batch: flatten inflight multicall requests
        const contracts: any[] = []

        for (let batchIdx = 0; batchIdx < batch.length; batchIdx++) {
          const inflightRequest = batch[batchIdx]

          // append new calls to the batch
          for (const call of inflightRequest.request.calls) {
            // Allow nullish input calls but don't pass them to the underlying multicall function.
            // Nullish calls results are automatically unsuccessful.
            // This allows us to "chain" multicall responses while preserving input indices
            if (call && isAddress(call?.target || '')) {
              contracts.push({
                address: call?.target,
                abi: [inflightRequest.request.abi],
                functionName: inflightRequest.request.abi.name,
                // @ts-ignore
                args: call.params,
              })
            }
          }
        }

        try {
          const multicallRes = await providers[this._chain].multicall({ contracts })

          // map results back to their original requests
          let callIdx = 0
          for (let batchIdx = 0; batchIdx < batch.length; batchIdx++) {
            const inflightRequest = batch[batchIdx]
            const result = []

            for (const call of inflightRequest.request.calls) {
              if (call && isAddress(call?.target || '')) {
                const response = multicallRes[callIdx++]
                result.push({
                  input: call,
                  success: response.status === 'success',
                  output: response.result,
                })
              } else {
                result.push({ input: call, success: false, output: null })
              }
            }

            inflightRequest.resolve(result)
          }
        } catch (error) {
          for (const inflightRequest of batch) {
            inflightRequest.reject(error as Error)
          }
        }
      }, 10)
    }

    return promise
  }
}

export interface Call<TAbi extends Abi[number] | readonly unknown[]> {
  target: `0x${string}`
  params?: DecodeFunctionResultParameters<TAbi[]>['args']
}

export interface MultiCallParams<
  TAbi extends Abi[number] | readonly unknown[] = AbiFunction,
  Call extends { target: `0x${string}`; params?: DecodeFunctionResultParameters<TAbi[]>['args'] } = {
    target: `0x${string}`
  },
> {
  ctx: BaseContext
  abi: DecodeFunctionResultParameters<TAbi[]>['abi'][number]
  calls: (Call | null)[]
}

export type MultiCallResult<TAbi extends Abi[number] | readonly unknown[]> =
  | {
      success: true
      input: { target: `0x${string}`; params?: DecodeFunctionResultParameters<TAbi[]>['args'] }
      output: DecodeFunctionResultReturnType<TAbi[]>
    }
  | {
      success: false
      input: { target: `0x${string}`; params?: DecodeFunctionResultParameters<TAbi[]>['args'] }
      output: null
    }

export const batchCallers: { [key: string]: BatchCaller } = {}
for (const chain of chains) {
  batchCallers[chain.id] = new BatchCaller(chain.id)
}

export async function multicall<
  TAbi extends Abi[number] | readonly unknown[],
  Call extends { target: `0x${string}`; params?: DecodeFunctionResultParameters<TAbi[]>['args'] },
>(options: {
  ctx: BaseContext
  abi: DecodeFunctionResultParameters<TAbi[]>['abi'][number]
  calls: (Call | null)[]
}): Promise<
  (
    | {
        success: true
        input: Call
        output: DecodeFunctionResultReturnType<TAbi[]>
      }
    | {
        success: false
        input: Call
        output: null
      }
  )[]
> {
  // @ts-ignore
  return batchCallers[options.ctx.chain].call(options) as any
}
