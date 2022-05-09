import { BigNumber } from '@ethersproject/bignumber'
import { Trade } from '@uniswap/router-sdk'
import { Currency, CurrencyAmount, Percent, TradeType } from '@uniswap/sdk-core'
import { Router as V2SwapRouter, Trade as V2Trade } from '@uniswap/v2-sdk'
import { FeeOptions, Trade as V3Trade } from '@uniswap/v3-sdk'
import { SWAP_ROUTER_ADDRESSES, V3_ROUTER_ADDRESS } from 'constants/addresses'
import useActiveWeb3React from 'hooks/useActiveWeb3React'
import { SwapMessage } from 'lib/hooks/swap/useSendSwapMessage'
import { useMemo } from 'react'

import { useArgentWalletContract } from './useArgentWalletContract'
import { useV2RouterContract } from './useContract'
import useENS from './useENS'
import { SignatureData } from './useERC20Permit'

export type AnyTrade =
  | V2Trade<Currency, Currency, TradeType>
  | V3Trade<Currency, Currency, TradeType>
  | Trade<Currency, Currency, TradeType>

function toHex(currencyAmount: CurrencyAmount<Currency>) {
  return `0x${currencyAmount.quotient.toString(16)}`
}

const ZERO_HEX = '0x0'

interface MessageParams {
  tradeType: string
  path: string[]
  amountIn: BigNumber
  amountOut: BigNumber
}

/**
 * Produces the on-chain method name to call and the hex encoded parameters to pass as arguments for a given trade.
 * @param trade to produce call parameters for
 * @param options options for the call parameters
 */
function swapMessageParametersV3(trade: AnyTrade): MessageParams {
  let path: string[] = []
  let singleHop = true
  if (trade instanceof V3Trade) {
    path = trade.swaps[0].route.tokenPath.map((p) => p.address)
    singleHop = trade.swaps[0].route.pools.length === 1
  } else if (trade instanceof V2Trade) {
    path = trade.route.path.map((p) => p.address)
  }

  const amountIn = BigNumber.from(trade.inputAmount.numerator.toString()).div(
    BigNumber.from(trade.inputAmount.denominator.toString())
  )
  const amountOut = BigNumber.from(trade.outputAmount.numerator.toString()).div(
    BigNumber.from(trade.outputAmount.denominator.toString())
  )

  let tradeType: string
  if (singleHop) {
    if (trade.tradeType === TradeType.EXACT_INPUT) {
      tradeType = 'V3_exactInputSingle'
    } else {
      tradeType = 'V3_exactOutputSingle'
    }
  } else {
    if (trade.tradeType === TradeType.EXACT_INPUT) {
      tradeType = 'v3_exactInput'
    } else {
      tradeType = 'v3_exactOutput'
    }
  }
  return {
    tradeType,
    path,
    amountIn,
    amountOut,
  }
}

// interface SwapCall {
//   address: string
//   calldata: string
//   value: string
// }

/**
 * Returns the swap calls that can be used to make the trade
 * @param trade trade to execute
 * @param allowedSlippage user allowed slippage
 * @param recipientAddressOrName the ENS name or address of the recipient of the swap output
 * @param signatureData the signature data of the permit of the input token amount, if available
 */
export function useSwapMessageArguments(
  trade: AnyTrade | undefined,
  allowedSlippage: Percent,
  recipientAddressOrName: string | null | undefined,
  signatureData: SignatureData | null | undefined,
  deadline: BigNumber | undefined,
  feeOptions: FeeOptions | undefined
): SwapMessage[] {
  const { account, chainId, library } = useActiveWeb3React()

  const { address: recipientAddress } = useENS(recipientAddressOrName)
  const recipient = recipientAddressOrName === null ? account : recipientAddress
  const routerContract = useV2RouterContract()
  const argentWalletContract = useArgentWalletContract()

  return useMemo(() => {
    if (!trade || !recipient || !library || !account || !chainId || !deadline) return []

    if (trade instanceof V2Trade) {
      if (!routerContract) return []
      const swapMethods = []

      swapMethods.push(
        V2SwapRouter.swapCallParameters(trade, {
          feeOnTransfer: false,
          allowedSlippage,
          recipient,
          deadline: deadline.toNumber(),
        })
      )

      if (trade.tradeType === TradeType.EXACT_INPUT) {
        swapMethods.push(
          V2SwapRouter.swapCallParameters(trade, {
            feeOnTransfer: true,
            allowedSlippage,
            recipient,
            deadline: deadline.toNumber(),
          })
        )
      }

      return swapMethods.map(({ methodName, args, value }) => {
        // SwapMessage
        const swap: SwapMessage = {
          router: routerContract.address,
          amountIn: BigNumber.from(trade.inputAmount),
          amountOut: BigNumber.from(trade.outputAmount),
          tradeType: `V2_${methodName}`, // TODO: enum?
          recipient,
          path: trade.route.path.map((p) => p.address),
          deadline: deadline.toNumber(),
          sqrtPriceLimitX96: BigNumber.from(0),
          fee: 0,
        }
        return swap
      })
      // ignore Argent for now
      // ====================================================================================

      // return swapMethods.map(({ methodName, args, value }) => {
      //   if (argentWalletContract && trade.inputAmount.currency.isToken) {
      //     return {
      //       address: argentWalletContract.address,
      //       calldata: argentWalletContract.interface.encodeFunctionData('wc_multiCall', [
      //         [
      //           approveAmountCalldata(trade.maximumAmountIn(allowedSlippage), routerContract.address),
      //           {
      //             to: routerContract.address,
      //             value,
      //             data: routerContract.interface.encodeFunctionData(methodName, args),
      //           },
      //         ],
      //       ]),
      //       value: '0x0',
      //     }
      //   } else {
      //     return {
      //       address: routerContract.address,
      //       calldata: routerContract.interface.encodeFunctionData(methodName, args),
      //       value,
      //     }
      //   }
      // })
    } else {
      // swap options shared by v3 and v2+v3 swap routers
      // const sharedSwapOptions = {
      //   fee: feeOptions,
      //   recipient,
      //   slippageTolerance: allowedSlippage,
      //   ...(signatureData
      //     ? {
      //         inputTokenPermit:
      //           'allowed' in signatureData
      //             ? {
      //                 expiry: signatureData.deadline,
      //                 nonce: signatureData.nonce,
      //                 s: signatureData.s,
      //                 r: signatureData.r,
      //                 v: signatureData.v as any,
      //               }
      //             : {
      //                 deadline: signatureData.deadline,
      //                 amount: signatureData.amount,
      //                 s: signatureData.s,
      //                 r: signatureData.r,
      //                 v: signatureData.v as any,
      //               },
      //       }
      //     : {}),
      // }

      const swapRouterAddress = chainId
        ? trade instanceof V3Trade
          ? V3_ROUTER_ADDRESS[chainId]
          : SWAP_ROUTER_ADDRESSES[chainId]
        : undefined
      if (!swapRouterAddress) return []

      // const { value, calldata } =
      //   trade instanceof V3Trade
      //     ? V3SwapRouter.swapCallParameters(trade, {
      //         ...sharedSwapOptions,
      //         deadline: deadline.toString(),
      //       })
      //     : SwapRouter.swapCallParameters(trade, {
      //         ...sharedSwapOptions,
      //         deadlineOrPreviousBlockhash: deadline.toString(),
      //       })

      const messageParams = swapMessageParametersV3(trade)

      const swap: SwapMessage = {
        router: swapRouterAddress,
        amountIn: messageParams.amountIn,
        amountOut: messageParams.amountOut,
        tradeType: messageParams.tradeType, // TODO: enum?
        recipient,
        path: messageParams.path,
        deadline: deadline.toNumber(),
        sqrtPriceLimitX96: BigNumber.from(0),
        fee: 0,
      }
      console.log('swap', swap)
      return [swap]
      // ====================================================================================

      // if (argentWalletContract && trade.inputAmount.currency.isToken) {
      //   return [
      //     {
      //       address: argentWalletContract.address,
      //       calldata: argentWalletContract.interface.encodeFunctionData('wc_multiCall', [
      //         [
      //           approveAmountCalldata(trade.maximumAmountIn(allowedSlippage), swapRouterAddress),
      //           {
      //             to: swapRouterAddress,
      //             value,
      //             data: calldata,
      //           },
      //         ],
      //       ]),
      //       value: '0x0',
      //     },
      //   ]
      // }
      // return [
      //   {
      //     address: swapRouterAddress,
      //     calldata,
      //     value,
      //   },
      // ]
    }
  }, [
    account,
    allowedSlippage,
    argentWalletContract,
    chainId,
    deadline,
    feeOptions,
    library,
    recipient,
    routerContract,
    signatureData,
    trade,
  ])
}
