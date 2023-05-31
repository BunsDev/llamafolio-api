import '@lib/providers'

import type { BaseContext } from '@lib/adapter'
import { batchCallers } from '@lib/multicall'
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

  return result[0].output
}
