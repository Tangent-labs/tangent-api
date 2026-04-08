import { AddressLike } from "ethers"

export interface ReferralData {
  code: string
  user_id: string
  created_at: Date
  expires_at?: Date | null
}

export interface UserData {
  id: bigint
  address: string
  onboarded: boolean
  code: string | null
}

export interface UserStatus {
  hasGeneratedCode: boolean
  hasUsedCode: boolean
  referralCode: string | null
  friends: number
}

export interface GetHistoricalMarketDataRoute {
  Params: { marketAddress: string; dateFrom: string }
  Querystring: { range?: string }
}

export interface GetOracleMarketDataRoute {
  Params: { marketAddress: string }
  Querystring: {
    dateEnd?: string
    bucketCount: number
    bucketSizeMinutes: number
  }
}

export interface UserTasks {
  Params: {
    userAddress: string
  }
}

export interface TotalSupply {
  Params: {
    dateTo: number
    dateFrom: string | number
    tokenAddress: string
  }
}

export interface PricesRoute {
  Params: {
    tokenAddresses: string
  }
}

export interface PriceSourcesRoute {}

export interface PriceHistoryRoute {
  Params: {
    tokenAddresses: string
  }
  Querystring: {
    range: "1D" | "1W" | "1M" | "1Y" | "ALL"
  }
}

export interface ProtocolTvl {
  Params: {
    dateTo: number
    dateFrom: string | number
  }
}

export interface sUSG {
  Params: {
    dateTo: number
    dateFrom: string | number
    tokenAddress: string
  }
}

export interface UserPoints {
  Params: {
    userAddress: string
    dateFrom: string
  }
}

export interface EventsRoute {
  Params: {
    account: string
    market: string
  }
}

export interface ReferralInput {
  referralCode: string
  signature: string
  account: string
  now: string
}

export interface RawEvent {
  label: string
  collat_amount: string
  usg_amount: string
  date: string
  tx_hash: string
}

export interface TransformedEvent {
  label: string
  collatAmount: string
  usgAmount: string
  date: string
  txHash: string
}

export interface TotalBorrowPoint {
  timestamp: Date
  value: string
}

export type UserVoteTaskRow = {
  taskId: number
  organisation: string
  url: string
  protocol: string
  description: string
  pointRate: number
  status: boolean
  points: number
  lastVotingPower: number
}

export type UserTaskRow = {
  taskId: number
  asset: string
  url: string
  protocol: string
  description: string
  pointRate: number
  status: boolean
  points: bigint
  priceUSD?: number
  tokenAddress?: string
}

export type UserPointsRow = {
  base_points: bigint
  referral_points: bigint
  total_points: bigint
  daily_rate: bigint
}

export type LeaderBoardPosition = {
  rank: number
  address: AddressLike
  pts: number
}

export type GodsonsLeaderboardItem = {
  rank: number
  address: AddressLike
  lpPoints: number
  votePts: number
}

export type MarketAPR = {
  currentAPR: {
    [rewardToken: string]: number
  }
  projectedAPR: {
    [rewardToken: string]: number
  }
  marketAddress: string
  marketName: string
}

export type SavingAccountsApy = {
  timestamp: Date
  value: number
  key: string
  tokenAddress: string
}

export type LpUserPointsResult = {
  lpTotalPoints: string
  lpDailyRate: string
}
