const { JsonRpcProvider } = require("@near-js/providers");
import axios from "axios";
import { transactions, utils } from "near-api-js";
import {
  FTStorageBalance,
  ONE_YOCTO_NEAR,
  RefFiFunctionCallOptions,
  TokenMetadata,
  Transaction,
  WRAP_NEAR_CONTRACT_ID,
  ftGetStorageBalance,
  ftGetTokenMetadata,
  ftViewFunction,
  toNonDivisibleNumber,
} from "@ref-finance/ref-sdk";
import Big from "big.js";

const NO_REQUIRED_REGISTRATION_TOKEN_IDS = [
  "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
];

export const STORAGE_TO_REGISTER_WITH_FT = "0.1";
export const STORAGE_TO_REGISTER_WITH_MFT = "0.1";

export interface IServerPool {
  amount_in?: string;
  min_amount_out: string;
  pool_id: string | number;
  token_in: string;
  token_out: string;
}

export interface IServerRoute {
  amount_in: string;
  min_amount_out: string;
  pools: IServerPool[];
  tokens?: TokenMetadata[];
}

export interface IEstimateSwapServerView {
  amount_in: string;
  amount_out: string;
  contract_in: string;
  contract_out: string;
  routes: IServerRoute[];
  contract?: string;
}

interface SmartRouter {
  result_code: string;
  result_message: string;
  result_data: IEstimateSwapServerView;
}

export interface SwapOptions {
  useNearBalance?: boolean;
  tokenIn: TokenMetadata;
  tokenOut: TokenMetadata;
  amountIn: string;
  slippageTolerance?: number;
  accountId: string;
  swapsToDoServer: IEstimateSwapServerView;
}

export async function latestBlockHash(): Promise<string> {
  const provider = new JsonRpcProvider({ url: "https://rpc.near.org" });
  const { sync_info } = await provider.status();

  return sync_info.latest_block_hash;
}

export async function fetchNonce(
  accountId: string,
  publicKey: utils.key_pair.PublicKey,
): Promise<number> {
  const provider = new JsonRpcProvider({ url: "https://rpc.near.org" });
  const rawAccessKey = await provider.query({
    request_type: "view_access_key",
    account_id: accountId,
    public_key: publicKey.toString(),
    finality: "optimistic",
  });

  return rawAccessKey.nonce;
}

export async function fetchNearView(
  accountId: string,
  methodName: string,
  argsBase64: string,
): Promise<any> {
  const provider = new JsonRpcProvider({
    url: "https://free.rpc.fastnear.com/",
  });
  const rawAccessKey = await provider.query({
    request_type: "call_function",
    account_id: accountId,
    args_base64: argsBase64,
    method_name: methodName,
    finality: "optimistic",
  });
  const resultBytes = rawAccessKey.result;
  const resultString = String.fromCharCode(...resultBytes);
  return JSON.parse(resultString);
}

const forgeUrl = (apiUrl: string, params: { [key: string]: any }) =>
  apiUrl +
  Object.keys(params)
    .sort()
    .reduce((paramString, p) => paramString + `${p}=${params[p]}&`, "?");

export async function pikespeakQuery(
  query: string,
  params: { [key: string]: any } = {},
) {
  try {
    const response = await axios.get(
      forgeUrl(`https://api.pikespeak.ai/${query}`, params),
      {
        headers: { "x-api-key": "29231aff-8c08-4f38-9096-b1d947050d27" },
      },
    );
    return response.data;
  } catch (error) {
    console.error(`Error fetching data from ${query}:`, error);
    throw error;
  }
}

export async function fetchFTMetadata(account: string) {
  return await fetchNearView(account, "ft_metadata", "e30=");
}

export async function createTransferProposal(
  accountId: string,
  publicKey: utils.key_pair.PublicKey,
  dao: string,
  receiver: string,
  quantity: string,
  tokenId: string,
) {
  const daoPolicy = await fetchNearView(dao, "get_policy", "e30=");
  const actions: transactions.Action[] = [];
  let decimals = 24;
  if (tokenId !== "") {
    const metadata = await fetchFTMetadata(tokenId);
    decimals = metadata?.decimals;
  }
  const amount = Big(quantity).mul(Big(10).pow(decimals)).toFixed();
  const args = {
    proposal: {
      description: "Transfer to " + receiver + ".",
      kind: {
        Transfer: {
          token_id: tokenId,
          receiver_id: receiver,
          amount: amount,
        },
      },
    },
  };

  // Get deposit from policy
  const deposit = daoPolicy?.proposal_bond || "100000000000000000000000"; // 0.1 NEAR default

  // Return the function call data in AI-friendly format
  return `
[
    {
      "methodName": "add_proposal",
      "args": ${JSON.stringify(args)},
      "gas": "200000000000000",
      "deposit": "${deposit}",
      "contractName": "${dao}"
    }
]
Use this data to call \`generate-transaction\` tool to generate a transaction.
  `;
}

export const check_registration = (
  tokenId: string,
  accountId: string,
): Promise<FTStorageBalance | null> => {
  return ftViewFunction(tokenId, {
    methodName: "check_registration",
    args: { account_id: accountId },
  });
};

export const native_usdc_has_upgrated = async (
  tokenId: string,
  accountId: string,
) => {
  try {
    await ftViewFunction(tokenId, {
      methodName: "storage_balance_of",
      args: { account_id: accountId },
    });
    return true;
  } catch (error) {
    await check_registration(tokenId, accountId).then((is_registration) => {
      if (is_registration) {
        return new Promise((resove) => {
          resove({ available: "1", total: "1" });
        });
      } else {
        return new Promise((resove) => {
          resove(null);
        });
      }
    });
    return false;
  }
};

export const swapFromServer = async ({
  tokenIn,
  tokenOut,
  amountIn,
  accountId,
  swapsToDoServer,
}: SwapOptions) => {
  const transactions: Transaction[] = [];
  const tokenOutActions: RefFiFunctionCallOptions[] = [];
  const { routes } = swapsToDoServer;
  const registerToken = async (token: TokenMetadata) => {
    const tokenRegistered = await ftGetStorageBalance(
      token.id,
      accountId,
    ).catch(() => {
      throw new Error(`${token.id} doesn't exist.`);
    });

    if (tokenRegistered === null) {
      if (NO_REQUIRED_REGISTRATION_TOKEN_IDS.includes(token.id)) {
        const r = await native_usdc_has_upgrated(token.id, accountId);
        if (r) {
          tokenOutActions.push({
            methodName: "storage_deposit",
            args: {
              registration_only: true,
              account_id: accountId,
            },
            gas: "30000000000000",
            amount: toNonDivisibleNumber(24, STORAGE_TO_REGISTER_WITH_MFT),
          });
        } else {
          tokenOutActions.push({
            methodName: "register_account",
            args: {
              account_id: accountId,
            },
            gas: "10000000000000",
          });
        }
      } else {
        tokenOutActions.push({
          methodName: "storage_deposit",
          args: {
            registration_only: true,
            account_id: accountId,
          },
          gas: "30000000000000",
          amount: toNonDivisibleNumber(24, STORAGE_TO_REGISTER_WITH_MFT),
        });
      }
      transactions.push({
        receiverId: token.id,
        functionCalls: tokenOutActions,
      });
    }
  };

  //making sure all actions get included.
  await registerToken(tokenOut);
  const actionsList: any[] = [];
  routes.forEach((route) => {
    route.pools.forEach((pool) => {
      if (pool.amount_in !== undefined && +pool.amount_in == 0) {
        delete pool.amount_in;
      }
      pool.pool_id = Number(pool.pool_id);
      actionsList.push(pool);
    });
  });
  transactions.push({
    receiverId: tokenIn.id,
    functionCalls: [
      {
        methodName: "ft_transfer_call",
        args: {
          receiver_id: "v2.ref-finance.near",
          amount: toNonDivisibleNumber(tokenIn.decimals, amountIn),
          msg: JSON.stringify({
            force: 0,
            actions: actionsList,
            ...(tokenOut.symbol == "NEAR" ? { skip_unwrap_near: false } : {}),
          }),
        },
        gas: "180000000000000",
        amount: ONE_YOCTO_NEAR,
      },
    ],
  });

  return transactions;
};

export async function getSwapTxn({
  accountId,
  sendAmount,
  tokenInId,
  tokenOutId,
}) {
  const swapRes: SmartRouter = await (
    await fetch(
      `https://smartrouter.ref.finance/findPath?amountIn=${sendAmount}&tokenIn=${tokenInId}&tokenOut=${tokenOutId}&pathDeep=3&slippage=0.1`,
    )
  ).json();
  const tokenInData = await ftGetTokenMetadata(tokenInId);
  const tokenOutData = await ftGetTokenMetadata(tokenOutId);

  const swapTxns = await swapFromServer({
    tokenIn: tokenInData,
    tokenOut: tokenOutData,
    amountIn: sendAmount,
    accountId: accountId,
    swapsToDoServer: swapRes.result_data,
  });
  return swapTxns;
}
