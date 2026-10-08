import { getAuth } from "firebase/auth";

import {
  FarmerPayoutAccountType,
  FarmerWalletType,
  FarmerWithdrawalType,
  WalletSummary,
  WalletTransaction,
} from "../types/wallet";

const BACKEND_URL = String(
  process.env.EXPO_PUBLIC_BACKEND_URL || ""
).replace(/\/+$/, "");

const getFirebaseIdToken = async () => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Your login session has expired. Please login again.");
  }

  return await user.getIdToken();
};

const requestBackend = async <T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  if (!BACKEND_URL) {
    throw new Error("EXPO_PUBLIC_BACKEND_URL is not configured.");
  }

  const token = await getFirebaseIdToken();

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Backend request failed with status ${response.status}.`
    );
  }

  return data as T;
};

export const getFarmerWallet = async (
  farmerId?: string
): Promise<FarmerWalletType> => {
  const result = await requestBackend<{
    success: boolean;
    wallet: FarmerWalletType;
  }>("/wallet/me");

  if (
    farmerId &&
    result.wallet.farmerId !== farmerId
  ) {
    throw new Error("Wallet ownership verification failed.");
  }

  return result.wallet;
};

export const getWalletTransactions = async (
  farmerId?: string
): Promise<WalletTransaction[]> => {
  const result = await requestBackend<{
    success: boolean;
    transactions: WalletTransaction[];
  }>("/wallet/transactions");

  if (!farmerId) {
    return result.transactions;
  }

  return result.transactions.filter(
    (transaction) => transaction.farmerId === farmerId
  );
};

export const getFarmerPayoutAccount = async (): Promise<
  FarmerPayoutAccountType | null
> => {
  const result = await requestBackend<{
    success: boolean;
    payoutAccount: FarmerPayoutAccountType | null;
  }>("/wallet/payout-account");

  return result.payoutAccount;
};

export const saveFarmerPayoutAccount = async (input: {
  accountName: string;
  accountNumber: string;
  postalCode?: string;
}): Promise<FarmerPayoutAccountType> => {
  const result = await requestBackend<{
    success: boolean;
    payoutAccount: FarmerPayoutAccountType;
  }>("/wallet/payout-account", {
    method: "PUT",
    body: JSON.stringify(input),
  });

  return result.payoutAccount;
};

export const requestFarmerWithdrawal = async (
  amount?: number
): Promise<FarmerWithdrawalType> => {
  const result = await requestBackend<{
    success: boolean;
    withdrawal: FarmerWithdrawalType;
    withdrawableAmount?: number;
  }>("/wallet/withdraw", {
    method: "POST",
    body: JSON.stringify(
      amount === undefined ? {} : { amount }
    ),
  });

  return result.withdrawal;
};

export type CommissionDepositResult = {
  depositId: string;
  amount: number;
  paymentRequestId: string;
  referenceId: string;
  paymentStatus: string;
  redirectUrl: string;
};

export type CommissionDepositStatus = {
  id: string;
  farmerId: string;
  amount: number;
  status: "pending" | "completed" | "failed" | "manual_review" | string;
  referenceId?: string | null;
  xenditPaymentStatus?: string | null;
  failureReason?: string | null;
};

export const createCommissionDeposit = async (
  amount: number
): Promise<CommissionDepositResult> => {
  const result = await requestBackend<CommissionDepositResult & { success: boolean }>(
    "/wallet/deposit",
    {
      method: "POST",
      body: JSON.stringify({ amount }),
    }
  );

  return result;
};

export const getCommissionDepositStatus = async (
  depositId: string
): Promise<{
  deposit: CommissionDepositStatus;
  commissionReserveBalance: number;
}> => {
  const result = await requestBackend<{
    success: boolean;
    deposit: CommissionDepositStatus;
    commissionReserveBalance: number;
  }>(`/wallet/deposits/${encodeURIComponent(depositId)}`);

  return result;
};

export const getWalletSummary = async (
  farmerId?: string
): Promise<WalletSummary> => {
  const [wallet, payoutAccount] = await Promise.all([
    getFarmerWallet(farmerId),
    getFarmerPayoutAccount(),
  ]);

  const withdrawableAmount = Math.max(
    0,
    Number(wallet.availableBalance || 0) -
      Number(wallet.reservedBalance || 0) -
      Number(wallet.codCommissionDue || 0) -
      Number(wallet.codDeliveryFeeDue || 0)
  );

  return {
    wallet,
    payoutAccount,
    withdrawableAmount,
  };
};
