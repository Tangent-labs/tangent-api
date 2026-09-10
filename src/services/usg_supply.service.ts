import { getAddress, JsonRpcProvider } from "ethers"
import { Contract } from "ethers"
import { formatEther } from "ethers"

const ERC20_ABI = ["function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)"]
const RPC_URL = process.env.RPC_URL || "https://ethereum-rpc.publicnode.com/"

const USG_ADDRESS = "0xb1c2db5d6ca03fce73dbd304d320bf76c55ae1b1"

const PEGKEEPER_ADDRESSES = ["0xf89615f75c8161dc185c03020240905f6b66bad9", "0x8a7f16508d1e8b48bdf36023f378cc04d9506d4e"]

export function circulatingFromBalances(totalSupply: bigint, pegKeeperBalances: bigint[]): bigint {
  const held = pegKeeperBalances.reduce((sum, balance) => sum + balance, 0n)
  return totalSupply > held ? totalSupply - held : 0n
}

export class UsgSupplyService {
  private usg: Contract
  private pegKeepers: string[]

  constructor() {
    // getAddress throws on anything that isn't a well-formed address, so a typo in
    // the constants above fails at boot instead of silently skewing the supply.
    const provider = new JsonRpcProvider(RPC_URL)
    this.usg = new Contract(getAddress(USG_ADDRESS), ERC20_ABI, provider)
    this.pegKeepers = PEGKEEPER_ADDRESSES.map((address) => getAddress(address))
  }

  async getTotalSupply(): Promise<string> {

    return formatEther(await this.usg.totalSupply())
  }

  async getCirculatingSupply(): Promise<string> {
    const [totalSupply, balances] = await Promise.all([
      this.usg.totalSupply() as Promise<bigint>,
      Promise.all(this.pegKeepers.map((address) => this.usg.balanceOf(address) as Promise<bigint>)),
    ])
    return formatEther(circulatingFromBalances(totalSupply, balances))
  }
}
