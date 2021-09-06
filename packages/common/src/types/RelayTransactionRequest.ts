import { PrefixedHexString } from 'ethereumjs-util'
import ow from 'ow'

import { Address } from './Aliases'
import { RelayRequest } from '../EIP712/RelayRequest'

export interface RelayMetadata {
  approvalData: PrefixedHexString
  relayHubAddress: Address
  relayMaxNonce: number
  signature: PrefixedHexString
  minAcceptableGasPrice: PrefixedHexString
}

export interface RelayTransactionRequest {
  relayRequest: RelayRequest
  metadata: RelayMetadata
}

export const RelayTransactionRequestShape = {
  relayRequest: {
    request: {
      from: ow.string,
      to: ow.string,
      data: ow.string,
      value: ow.string,
      nonce: ow.string,
      gas: ow.string,
      validUntil: ow.string
    },
    relayData: {
      gasPrice: ow.string,
      pctRelayFee: ow.string,
      baseRelayFee: ow.string,
      relayWorker: ow.string,
      paymaster: ow.string,
      paymasterData: ow.string,
      clientId: ow.string,
      forwarder: ow.string
    }
  },
  metadata: {
    approvalData: ow.string,
    relayHubAddress: ow.string,
    relayMaxNonce: ow.number,
    signature: ow.string,
    // in baseRelayFee bidding mode, gas price is not signed and cannot enforced by the RelayHub
    // client will consider relay transactions with low signed gas price as invalid
    // NOTE: this is not related to fee but the fact that Arbitrum will treat tx gasPrice as maximum, not actual price
    minAcceptableGasPrice: ow.string
  }
}
