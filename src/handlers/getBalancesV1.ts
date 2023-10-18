import { type LatestProtocolBalances, selectLatestProtocolsBalancesByFromAddress } from '@db/balances'
import { client } from '@db/clickhouse'
import { badRequest, serverError, success } from '@handlers/response'
import { areBalancesStale, BALANCE_UPDATE_THRESHOLD_SEC } from '@lib/balance'
import { isHex } from '@lib/contract'
import { unixFromDate } from '@lib/fmt'
import type { APIGatewayProxyHandler } from 'aws-lambda'

type Status = 'stale' | 'success'

interface BalancesResponse {
  status: Status
  updatedAt?: number
  nextUpdateAt: number
  protocols: LatestProtocolBalances[]
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const address = event.pathParameters?.address?.toLowerCase() as `0x${string}`
  console.log('Get balances', address)
  if (!address) {
    return badRequest('Missing address parameter')
  }

  if (!isHex(address)) {
    return badRequest('Invalid address parameter, expected hex')
  }

  try {
    const { updatedAt, protocolsBalances } = await selectLatestProtocolsBalancesByFromAddress(client, address)

    const status = updatedAt === undefined || areBalancesStale(updatedAt) ? 'stale' : 'success'

    const balancesResponse: BalancesResponse = {
      status,
      updatedAt,
      nextUpdateAt: updatedAt ? updatedAt + BALANCE_UPDATE_THRESHOLD_SEC : unixFromDate(new Date()),
      protocols: protocolsBalances,
    }

    return success(balancesResponse)
  } catch (error) {
    console.error('Failed to retrieve balances', { error, address })
    return serverError('Failed to retrieve balances', { error, address })
  }
}
