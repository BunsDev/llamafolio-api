import { Balance, BalancesContext, Contract } from '@lib/adapter'
import { abi as erc20Abi } from '@lib/erc20'
import { multicall } from '@lib/multicall'
import { isSuccess } from '@lib/type'
import { BigNumber, utils } from 'ethers'

const abi = {
  priceE18: {
    inputs: [],
    name: 'priceE18',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
}

export async function getFlamincomeFarmBalances(ctx: BalancesContext, farmers: Contract[]): Promise<Balance[]> {
  const balances: Balance[] = []

  const [balancesOfsRes, exchangeRatesRes] = await Promise.all([
    multicall({
      ctx,
      calls: farmers.map((farmer) => ({ target: farmer.address, params: [ctx.address] })),
      abi: erc20Abi.balanceOf,
    }),
    multicall({
      ctx,
      calls: farmers.map((farmer) => ({ target: farmer.address })),
      abi: abi.priceE18,
    }),
  ])

  for (let farmerIdx = 0; farmerIdx < farmers.length; farmerIdx++) {
    const farmer = farmers[farmerIdx]
    const underlying = farmer.underlyings?.[0] as Contract
    const balanceOfRes = balancesOfsRes[farmerIdx]
    const exchangeRateRes = exchangeRatesRes[farmerIdx]

    if (!underlying || !isSuccess(balanceOfRes) || !isSuccess(exchangeRateRes)) {
      continue
    }

    balances.push({
      ...farmer,
      amount: BigNumber.from(balanceOfRes.output).mul(exchangeRateRes.output).div(utils.parseEther('1.0')),
      underlyings: [underlying],
      rewards: undefined,
      category: 'farm',
    })
  }

  return balances
}
