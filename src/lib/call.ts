import '@lib/providers'

import type { BaseContext } from '@lib/adapter'
import { batchCallers } from '@lib/providers/batch-call'
import type { Abi } from 'abitype'
import type { DecodeFunctionResultParameters, DecodeFunctionResultReturnType } from 'viem'

export async function call<TAbi extends Abi[number] | readonly unknown[]>(options: {
  ctx: BaseContext
  target: `0x${string}`
  abi: DecodeFunctionResultParameters<TAbi[]>['abi'][number]
  params?: DecodeFunctionResultParameters<TAbi[]>['args']
}): Promise<DecodeFunctionResultReturnType<TAbi[]>> {
  const result = (await batchCallers[options.ctx.chain].call({
    ctx: options.ctx,
    // @ts-ignore
    calls: [{ target: options.target, params: options.params }],
    // @ts-ignore
    abi: options.abi,
  })) as any[]

  // throw if multicall response is unsuccessful as we don't return "output" in single calls
  if (!result[0].success) {
    // @ts-ignore
    throw new Error(`Call ${options.abi.name} failed`, result[0].output)
  }

  return result[0].output
}
