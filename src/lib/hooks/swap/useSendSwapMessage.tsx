import { BigNumber } from '@ethersproject/bignumber'
import { JsonRpcProvider, TransactionResponse } from '@ethersproject/providers'
// eslint-disable-next-line no-restricted-imports
// import { t, Trans } from '@lingui/macro'
import { Trade } from '@uniswap/router-sdk'
import { Currency, TradeType } from '@uniswap/sdk-core'
import { Trade as V2Trade } from '@uniswap/v2-sdk'
import { Trade as V3Trade } from '@uniswap/v3-sdk'
import { useMemo } from 'react'
// import { calculateGasMargin } from 'utils/calculateGasMargin'
// import isZero from 'utils/isZero'
// import { swapErrorToUserReadableMessage } from 'utils/swapErrorToUserReadableMessage'

type AnyTrade =
  | V2Trade<Currency, Currency, TradeType>
  | V3Trade<Currency, Currency, TradeType>
  | Trade<Currency, Currency, TradeType>

/** Definition of an order in our EIP-712 message */
export interface SwapMessage {
  router: string // address
  amountIn: BigNumber
  amountOut: BigNumber
  tradeType: string // TODO: enum?
  recipient: string // address
  path: string[]
  deadline: number
  sqrtPriceLimitX96: BigNumber
  fee: number
}

// returns a function that will ask the user to sign a message
export default function useSendSwapMessage(
  account: string | null | undefined,
  chainId: number | undefined,
  library: JsonRpcProvider | undefined,
  trade: AnyTrade | undefined, // trade to execute, required
  swapMessages: SwapMessage[]
): { callback: null | (() => Promise<TransactionResponse>) } {
  return useMemo(() => {
    if (!trade || !library || !account || !chainId) {
      return { callback: null }
    }
    return {
      callback: async function onSwap(): Promise<TransactionResponse> {
        console.log('[useSendSwapMessage] swapMessages', swapMessages)

        const message = swapMessages[0]
        const verifyingContract = '0xFbdd1b7ac7b9C2411b695B9c60a0d0643C1FA175'

        const testdata = {
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ],
            SwapOrder: [
              { name: 'router', type: 'address' },
              { name: 'amountIn', type: 'uint256' },
              { name: 'amountOut', type: 'uint256' },
              { name: 'tradeType', type: 'string' },
              { name: 'recipient', type: 'address' },
              { name: 'path', type: 'address[]' },
              { name: 'deadline', type: 'uint' },
              { name: 'sqrtPriceLimitX96', type: 'uint160' },
              { name: 'fee', type: 'uint24' },
            ],
          },
          domain: {
            name: 'SonOfASwap',
            version: '1',
            chainId,
            verifyingContract,
          },
          primaryType: 'SwapOrder',
          message: {
            router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
            amountIn: message.amountIn._hex,
            amountOut: message.amountOut._hex, // 3000 DAI/ETH
            tradeType: 'EXACT_INPUT_SINGLE_V3',
            recipient: account,
            path: message.path,
            deadline: BigNumber.from(Math.floor((Date.now() + 30 * 60 * 1000) / 1000))._hex, // 30 min from now
            sqrtPriceLimitX96: 0x0,
            fee: 0x0,
          },
        }

        return library.send('eth_signTypedData_v4', [await library.getSigner().getAddress(), JSON.stringify(testdata)])
      },
    }
  }, [account, chainId, library, swapMessages, trade])
}
