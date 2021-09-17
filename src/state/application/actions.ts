import { createAction } from '@reduxjs/toolkit'
import { Fees } from '@alchemist-coin/mistx-connect'
import { PrivateTransactionDetails } from '../transactions/actions'

export type PopupContent = {
  txn: {
    hash: string
    success: boolean
    summary?: string
    privateTransaction?: boolean
    privateTransactionDetails?: PrivateTransactionDetails
  }
}

export enum ApplicationModal {
  WALLET,
  SETTINGS,
  SELF_CLAIM,
  ADDRESS_CLAIM,
  CLAIM_POPUP,
  MENU,
  DELEGATE,
  VOTE,
  POOL_OVERVIEW_OPTIONS,
  ARBITRUM_OPTIONS,
}

export const updatePrivateTransactionFees = createAction<{ privateTransactionFees: Fees | null }>(
  'application/updatePrivateTransactionFees'
)
export const updateChainId = createAction<{ chainId: number | null }>('application/updateChainId')
export const updateBlockNumber = createAction<{ chainId: number; blockNumber: number }>('application/updateBlockNumber')
export const setOpenModal = createAction<ApplicationModal | null>('application/setOpenModal')
export const addPopup =
  createAction<{ key?: string; removeAfterMs?: number | null; content: PopupContent }>('application/addPopup')
export const removePopup = createAction<{ key: string }>('application/removePopup')
export const setChainConnectivityWarning = createAction<{ warn: boolean }>('application/setChainConnectivityWarning')
