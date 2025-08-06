export interface ReferralData {
  code: string;
  user_id: string;
  created_at: Date;
  expires_at?: Date | null;
}

export interface UserData {
  id: bigint;
  address: string;
  onboarded: boolean;
  code: string | null;
}

export interface UserStatus {
  hasGeneratedCode: boolean;
  hasUsedCode: boolean;
  referralCode: string | null;
  friends: number;
}

export interface EventsRoute {
  Params: {
    account: string;
    market: string;
  };
}

export interface ReferralInput {
  referralCode: string;
  signature: string;
  account: string;
}

export interface RawEvent {
  label: string;
  collat_amount: string;
  usg_amount: string;
  date: string;
  tx_hash: string;
}

export interface TransformedEvent {
  label: string;
  collatAmount: string;
  usgAmount: string;
  date: string;
  txHash: string;
}

export interface TotalBorrowPoint {
  timestamp: Date;
  value: string;
}
