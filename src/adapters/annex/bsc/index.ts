import { getAnnexFarmBalances } from '@adapters/annex/bsc/balance'
import { getAnnexContracts } from '@adapters/annex/bsc/contract'
import type { BaseContext, Contract, GetBalancesHandler } from '@lib/adapter'
import { resolveBalances } from '@lib/balance'
import { getMarketsBalances, getMarketsContracts } from '@lib/compound/v2/market'

const comptroller: Contract = {
  chain: 'bsc',
  address: '0xb13026db8aafa2fd6d23355533dccccbd4442f4c',
}

const annSingleFarm: Contract = {
  chain: 'bsc',
  address: '0x98936bde1cf1bff1e7a8012cee5e2583851f2067',
  token: '0x98936bde1cf1bff1e7a8012cee5e2583851f2067',
  masterchef: '0x9c821500eaba9f9737fdaadf7984dff03edc74d1',
  pid: 2,
}

const masterchef: Contract = {
  chain: 'bsc',
  address: '0x9c821500eaba9f9737fdaadf7984dff03edc74d1',
}

const masterchef_v2: Contract = {
  chain: 'bsc',
  address: '0x9c821500eaba9f9737fdaadf7984dff03edc74d1',
}

export const getContracts = async (ctx: BaseContext) => {
  const [markets, pools] = await Promise.all([
    getMarketsContracts(ctx, {
      comptrollerAddress: comptroller.address,
      underlyingAddressByMarketAddress: {
        // cBNB -> wBNB
        '0xc5a83ad9f3586e143d2c718e8999206887ef9ddc': '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      },
    }),
    getAnnexContracts(ctx, [masterchef, masterchef_v2]),
  ])

  return {
    contracts: { markets, masterchef, masterchef_v2, pools: [...pools, annSingleFarm] },
    revalidate: 60 * 60,
  }
}

export const getBalances: GetBalancesHandler<typeof getContracts> = async (ctx, contracts) => {
  const balances = await resolveBalances<typeof getContracts>(ctx, contracts, {
    markets: getMarketsBalances,
    pools: getAnnexFarmBalances,
  })

  return {
    groups: [{ balances }],
  }
}
