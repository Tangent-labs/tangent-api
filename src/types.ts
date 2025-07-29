export interface ReferralData {
  code: string;
  user_id: string;
  created_at: Date;
  expires_at?: Date | null;
}

export interface UserStatus {
  hasUsedCode: boolean;
  referralCode: string | null;
  friends: number;
}

export interface UserData {
  id: string;
  address: string;
  onboarded: boolean;
  referral_code?: string | null;
  referral_count: number;
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

//

export interface RawEvent {
  label: string;
  collat_amount: string;
  usg_amount: string;
  date: string;
  tx_hash: string;
}

// Interface for the transformed event for the frontend
export interface TransformedEvent {
  label: string;
  collatAmount: string;
  usgAmount: string;
  date: string;
  txHash: string;
}
