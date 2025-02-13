import { Contract as EthersContract } from 'ethers'

import { JsonFragment, ParamType } from '@ethersproject/abi'
import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers'
import { toBN } from './web3js/Web3JSUtils'

function getComponent (key: string, components: readonly ParamType[]): JsonFragment | undefined {
  // @ts-ignore
  const component = components[key]
  if (component != null) {
    return component
  }
  return components.find(it => it.name === key)
}

function retypeItem (abiOutput: Partial<ParamType>, ret: any): any {
  if (abiOutput.type == null) {
    return ret
  }
  if (abiOutput.type.includes('int')) {
    return toBN(ret.toString())
  } else if (abiOutput.type === 'tuple[]') {
    return ret.map((item: any) => retypeItem(
      { ...abiOutput, type: 'tuple' }, item
    ))
  } else if (abiOutput.type.includes('tuple') && abiOutput.components != null) {
    const keys = Object.keys(ret)
    const newRet: any = {}
    for (let i = 0; i < keys.length; i++) {
      const component = getComponent(keys[i], abiOutput.components)
      if (component == null) {
        newRet[keys[i]] = ret[keys[i]]
        continue
      }
      newRet[keys[i]] = retypeItem(component, ret[keys[i]])
    }
    return newRet
  } else {
    return ret
  }
}

// restore TF type: uint are returned as string in web3, and as BN in TF.
function retype (outputs?: readonly JsonFragment[], ret?: any): any {
  if (outputs?.length === 1) {
    return retypeItem(outputs[0], ret)
  } else {
    const response: { [key in number]: Object } = {}
    outputs?.forEach((value, index) => {
      response[index] = retypeItem(value, ret[index])
    })
    return response
  }
}

export class Contract<T> {
  provider!: JsonRpcProvider
  signer!: JsonRpcSigner

  constructor (readonly contractName: string, readonly abi: JsonFragment[]) {
  }

  createContract (address: string, signer: JsonRpcSigner): EthersContract {
    const ethersContract = new EthersContract(address, this.abi)
    return ethersContract.connect(signer ?? this.provider)
  }

  // return a contract instance at the given address.
  // UNLIKE TF, we don't do any on-chain check if the contract exist.
  // the application is assumed to call some view function (e.g. version) that implicitly verifies a contract
  // is deployed at that address (and has that view function)
  async at (address: string): Promise<T> {
    // TODO: this is done to force cache the 'from' address to avoid Ethers making a call to 'eth_accounts' every time
    const signerFromAddress = await this.signer.getAddress()
    const addressAwareSigner = this.provider.getSigner(signerFromAddress)
    const contract = this.createContract(address, addressAwareSigner)
    const obj = {
      address,
      contract,
      async getPastEvents (name: string | null, options: any) {
        // @ts-ignore
        return contract.getPastEvents(name, options).map(e => ({
          ...e,
          args: e.returnValues // TODO: web3 uses strings, Truffle uses BN for numbers
        }))
      }
    } as any

    this.abi.forEach(m => {
      const methodName: string = m.name ?? ''
      const nArgs = m.inputs?.length ?? 0
      const isViewFunction = m.stateMutability === 'view' || m.stateMutability === 'pure'
      obj[methodName] = async function () {
        let args = Array.from(arguments)
        let options = {}
        if (args.length === nArgs + 1 && typeof args[args.length - 1] === 'object') {
          options = args[args.length - 1]
          args = args.slice(0, args.length - 1)
        }

        // TODO: this substitution seems redundant - try removing it!
        let methodCall: any
        if (!isViewFunction) {
          methodCall = contract.functions[methodName]
          return methodCall(...args, options)
        } else {
          methodCall = contract.callStatic[methodName]
          return methodCall(...args, options)
            .then((res: any) => {
              return retype(m.outputs, res)
            })
        }
        // console.log('===calling', methodName, args)
        // return await methodCall.call(options)
        //   .catch((e: Error) => {
        //     console.log('===ex1', e)
        //     throw e
        //   })
      }
    })
    return obj as unknown as T
  }

  setProvider (provider: JsonRpcProvider, _: unknown): void {
    this.provider = provider
    this.signer = provider.getSigner()
  }
}

export function TruffleContract ({ contractName, abi }: { contractName: string, abi: any[] }): any {
  return new Contract(contractName, abi)
}
