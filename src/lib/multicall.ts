import '@lib/providers'

import type { BaseContext } from '@lib/adapter'
import { batchCallers } from '@lib/providers/batch-call'
import type { Abi, AbiFunction } from 'abitype'
import type { DecodeFunctionResultParameters, DecodeFunctionResultReturnType } from 'viem'

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
