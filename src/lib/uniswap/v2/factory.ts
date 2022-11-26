import { Contract } from '@lib/adapter'
import { range } from '@lib/array'
import { call } from '@lib/call'
import { Category } from '@lib/category'
import { Chain } from '@lib/chains'
import { resolveERC20Details } from '@lib/erc20'
import { Call, multicall } from '@lib/multicall'
import { isNotNullish, isSuccess } from '@lib/type'

const abi = {
  allPairsLength: {
    constant: true,
    inputs: [],
    name: 'allPairsLength',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  allPairs: {
    constant: true,
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'allPairs',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  token0: {
    constant: true,
    inputs: [],
    name: 'token0',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  token1: {
    constant: true,
    inputs: [],
    name: 'token1',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
}

export interface getPairsContractsParams {
  chain: Chain
  factoryAddress: string
  // optional number of pairs
  length?: number
}

export async function getPairsContracts({ chain, factoryAddress, length }: getPairsContractsParams) {
  const allPairsLengthRes = await call({
    chain,
    abi: abi.allPairsLength,
    target: factoryAddress,
  })

  let allPairsLength = parseInt(allPairsLengthRes.output)
  if (length !== undefined) {
    allPairsLength = Math.min(allPairsLength, length)
  }

  const allPairsRes = await multicall({
    chain,
    calls: range(0, allPairsLength).map((_, i) => ({
      target: factoryAddress,
      params: [i],
    })),
    abi: abi.allPairs,
  })

  const contracts: Contract[] = allPairsRes.filter(isSuccess).map((res) => ({ chain, address: res.output }))

  return getPairsDetails(chain, contracts)
}

export async function getPairsDetails(chain: Chain, contracts: Contract[]): Promise<Contract[]> {
  const addresses = contracts.map((contract) => contract.address)

  const calls: Call[] = addresses.map((address) => ({
    target: address,
    params: [],
  }))

  const [token0sRes, token1sRes] = await Promise.all([
    multicall({
      chain,
      calls,
      abi: abi.token0,
    }),

    multicall({
      chain,
      calls,
      abi: abi.token1,
    }),
  ])

  const { pairs, token0s, token1s } = await resolveERC20Details(chain, {
    pairs: calls.map((res) => res.target),
    token0s: token0sRes.map((res) => res.output),
    token1s: token1sRes.map((res) => res.output),
  })

  return contracts
    .map((contract, i) => {
      const pairRes = pairs[i]
      const token0Res = token0s[i]
      const token1Res = token1s[i]

      if (!isSuccess(pairRes) || !isSuccess(token0Res) || !isSuccess(token1Res)) {
        return null
      }

      return {
        ...contract,
        ...pairRes.output,
        category: 'lp' as Category,
        underlyings: [token0Res.output, token1Res.output],
      }
    })
    .filter(isNotNullish)
}
