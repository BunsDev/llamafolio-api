import { selectLatestBalancesSnapshotByFromAddresses } from '@db/balances'
import { client } from '@db/clickhouse'
import { badRequest, serverError, success } from '@handlers/response'
import type { Chain } from '@lib/chains'
import { isHex } from '@lib/contract'
import { parseAddresses } from '@lib/fmt'
import type { TUnixTimestamp } from '@lib/type'
import type { APIGatewayProxyHandler } from 'aws-lambda'

export interface SnapshotChainResponse {
  id: Chain
  balanceUSD: number
  debtUSD: number
  rewardUSD: number
}

export interface LatestSnapshotResponse {
  balanceUSD: number
  debtUSD: number
  rewardUSD: number
  chains: SnapshotChainResponse[]
  updatedAt?: TUnixTimestamp
}

export const handler: APIGatewayProxyHandler = async (event, _context) => {
  const addresses = parseAddresses(event.pathParameters?.address || '')
  if (addresses.length === 0) {
    return badRequest('Missing address parameter')
  }

  if (addresses.some((address) => !isHex(address))) {
    return badRequest('Invalid address parameter, expected hex')
  }

  try {
    const lastBalancesGroups = await selectLatestBalancesSnapshotByFromAddresses(client, addresses)

    return success(lastBalancesGroups, { maxAge: 5 * 60, swr: 60 })
  } catch (error) {
    console.error('Failed to retrieve latest snapshot', error)
    return serverError('Failed to retrieve latest snapshot', { error })
  }
}
