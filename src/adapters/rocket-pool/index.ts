import { Adapter } from "@lib/adapter";
import { getERC20BalanceOf } from "@lib/erc20";
import { Token } from "@lib/token";

const rETH: Token = {
  chain: "ethereum",
  address: "0xae78736cd615f374d3085123a210448e74fc6393",
  symbol: "rETH",
  decimals: 18,
  coingeckoId: "rocket-pool-eth",
};

const adapter: Adapter = {
  id: "rocket-pool",
  getContracts() {
    return {
      contracts: [rETH],
    };
  },
  async getBalances(ctx, contracts) {
    const balances = await getERC20BalanceOf(
      ctx,
      "ethereum",
      contracts as Token[]
    );

    return {
      balances: balances.map((bal) => ({ ...bal, category: "stake" })),
    };
  },
};

export default adapter;
