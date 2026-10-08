import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFarmerAlert } from "@/context/FarmerAlertContext";

import {
  getFarmerPayoutAccount,
  getFarmerWallet,
  getWalletSummary,
  getWalletTransactions,
  createCommissionDeposit,
  getCommissionDepositStatus,
  requestFarmerWithdrawal,
  saveFarmerPayoutAccount,
} from "@/src/services/walletService";

import {
  FarmerPayoutAccountType,
  FarmerWalletType,
  WalletTransaction,
} from "@/src/types/wallet";

const formatMoney = (value: number) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (timestamp: any) => {
  if (!timestamp) return "Date unavailable";

  try {
    const date =
      typeof timestamp?.toDate === "function"
        ? timestamp.toDate()
        : typeof timestamp?.seconds === "number"
          ? new Date(timestamp.seconds * 1000)
          : new Date(timestamp);

    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return date.toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "Date unavailable";
  }
};

const transactionTitle = (transaction: WalletTransaction) => {
  switch (transaction.type) {
    case "gcash_earning":
      return "GCash Order Earning";
    case "commission_deposit":
      return "Commission Reserve Deposit";
    case "cod_commission_reserved":
      return "COD Commission Reserved";
    case "cod_commission_reservation_released":
      return "COD Commission Reserve Released";
    case "gcash_commission":
      return "GCash Commission";
    case "cod_commission_debit":
      return "COD Commission Collected";
    case "cod_commission_due":
      return "COD Commission Due";
    case "cod_commission_collected":
      return "COD Commission Collected";
    case "cod_delivery_fee_due":
      return "COD Delivery Fee Due";
    case "cod_delivery_fee_collected":
      return "COD Delivery Fee Collected";
    case "withdrawal":
      return "GCash Withdrawal";
    case "withdrawal_reversal":
      return "Withdrawal Reversed";
    default:
      return "Wallet Adjustment";
  }
};

const transactionColor = (transaction: WalletTransaction) => {
  if (
    transaction.type === "gcash_earning" ||
    transaction.type === "commission_deposit" ||
    transaction.type === "cod_commission_reservation_released"
  ) return "#15803D";
  if (
    transaction.type === "withdrawal" ||
    transaction.type === "cod_commission_collected" ||
    transaction.type === "cod_commission_debit" ||
    transaction.type === "gcash_commission" ||
    transaction.type === "cod_delivery_fee_collected"
  ) {
    return "#DC2626";
  }
  if (transaction.type === "withdrawal_reversal") return "#2563EB";
  return "#D97706";
};

const transactionIcon = (transaction: WalletTransaction) => {
  if (
    transaction.type === "gcash_earning" ||
    transaction.type === "commission_deposit" ||
    transaction.type === "cod_commission_reservation_released"
  ) return "arrow-down-circle";
  if (transaction.type === "withdrawal") return "arrow-up-circle";
  if (transaction.type === "withdrawal_reversal") return "refresh-circle";
  if (
    transaction.type === "cod_commission_collected" ||
    transaction.type === "cod_commission_debit" ||
    transaction.type === "gcash_commission" ||
    transaction.type === "cod_delivery_fee_collected"
  ) {
    return "remove-circle";
  }
  return "alert-circle";
};

export default function FarmerWallet() {
  const router = useRouter();
  const Alert = useFarmerAlert();

  const [wallet, setWallet] = useState<FarmerWalletType | null>(null);
  const [payoutAccount, setPayoutAccount] =
    useState<FarmerPayoutAccountType | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  const [loading, setLoading] = useState(true);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const depositPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const loadWallet = useCallback(async () => {
    try {
      setLoading(true);

      const [summary, history] = await Promise.all([
        getWalletSummary(),
        getWalletTransactions(),
      ]);

      setWallet(summary.wallet);
      setPayoutAccount(summary.payoutAccount);
      setTransactions(history);

      setAccountName(summary.payoutAccount?.accountName || "");
      setPostalCode(summary.payoutAccount?.postalCode || "");
    } catch (error: any) {
      console.log("LOAD FARMER WALLET ERROR:", error);

      Alert.alert(
        "Wallet Error",
        error?.message || "Failed to load your wallet."
      );
    } finally {
      setLoading(false);
    }
  }, [Alert]);

  useFocusEffect(
    useCallback(() => {
      loadWallet();
    }, [loadWallet])
  );

  const withdrawableAmount = wallet
    ? Math.max(
        0,
        Number(wallet.availableBalance || 0) -
          Number(wallet.reservedBalance || 0) -
          Number(wallet.codCommissionDue || 0) -
          Number(wallet.codDeliveryFeeDue || 0)
      )
    : 0;

  const openPayoutModal = () => {
    setAccountName(payoutAccount?.accountName || "");
    setAccountNumber("");
    setPostalCode(payoutAccount?.postalCode || "");
    setShowPayoutModal(true);
  };

  const handleSavePayoutAccount = async () => {
    const cleanName = accountName.trim();
    const cleanNumber = accountNumber.replace(/\D/g, "");
    const cleanPostal = postalCode.replace(/\D/g, "");

    if (cleanName.length < 3) {
      Alert.alert("Required", "Enter the GCash account name.");
      return;
    }

    if (!/^09\d{9}$/.test(cleanNumber)) {
      Alert.alert(
        "Invalid GCash",
        "Use a valid 11-digit GCash number such as 09171234567."
      );
      return;
    }

    if (!/^\d{4}$/.test(cleanPostal)) {
      Alert.alert(
        "Invalid Postal Code",
        "Enter a valid 4-digit Philippine postal code."
      );
      return;
    }

    try {
      setSavingPayout(true);

      const saved = await saveFarmerPayoutAccount({
        accountName: cleanName,
        accountNumber: cleanNumber,
        postalCode: cleanPostal,
      });

      setPayoutAccount(saved);
      setShowPayoutModal(false);
      setAccountNumber("");

      Alert.alert(
        "GCash Saved",
        "Your GCash payout account is ready for withdrawals."
      );
    } catch (error: any) {
      console.log("SAVE PAYOUT ACCOUNT ERROR:", error);
      Alert.alert(
        "Save Failed",
        error?.message || "Failed to save your GCash account."
      );
    } finally {
      setSavingPayout(false);
    }
  };

  const stopDepositPolling = () => {
    if (depositPollRef.current) {
      clearInterval(depositPollRef.current);
      depositPollRef.current = null;
    }
  };

  const startDepositPolling = (depositId: string) => {
    stopDepositPolling();

    let attempts = 0;

    depositPollRef.current = setInterval(async () => {
      attempts += 1;

      try {
        const result = await getCommissionDepositStatus(depositId);
        const status = result.deposit.status;

        if (status === "completed") {
          stopDepositPolling();
          await loadWallet();
          Alert.alert(
            "Deposit Completed",
            `${formatMoney(result.deposit.amount)} has been added to your COD Commission Reserve.`
          );
          return;
        }

        if (status === "failed" || status === "manual_review") {
          stopDepositPolling();
          await loadWallet();
          Alert.alert(
            "Deposit Not Completed",
            result.deposit.failureReason ||
              "The commission reserve deposit was not completed."
          );
          return;
        }
      } catch (error) {
        console.log("DEPOSIT STATUS ERROR:", error);
      }

      if (attempts >= 15) {
        stopDepositPolling();
        await loadWallet();
      }
    }, 2000);
  };

  const handleDeposit = async () => {
    const amount = Number(depositAmount.replace(/,/g, "").trim());

    if (!Number.isFinite(amount) || amount < 100) {
      Alert.alert(
        "Invalid Amount",
        "Minimum COD Commission Reserve deposit is ₱100.00."
      );
      return;
    }

    try {
      setDepositLoading(true);

      const result = await createCommissionDeposit(amount);
      setDepositAmount("");
      setShowDepositModal(false);

      startDepositPolling(result.depositId);

      if (result.redirectUrl) {
        await Linking.openURL(result.redirectUrl);
      }

      await loadWallet();

      Alert.alert(
        "GCash Payment Opened",
        "Complete the GCash payment. Return to FarmGate afterward; the Commission Reserve will refresh automatically."
      );
    } catch (error: any) {
      console.log("COMMISSION DEPOSIT ERROR:", error);
      Alert.alert(
        "Deposit Failed",
        error?.message || "Failed to start the commission reserve deposit."
      );
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!payoutAccount) {
      setShowWithdrawModal(false);
      openPayoutModal();
      return;
    }

    if (withdrawableAmount <= 0) {
      Alert.alert(
        "No Withdrawable Balance",
        "There is no withdrawable earnings balance available yet. Settle any outstanding COD deductions first."
      );
      return;
    }

    try {
      setWithdrawLoading(true);
      setShowWithdrawModal(false);

      const withdrawal = await requestFarmerWithdrawal(withdrawableAmount);

      await loadWallet();

      if (withdrawal.status === "succeeded") {
        Alert.alert(
          "Withdrawal Sent",
          `${formatMoney(withdrawal.amount)} was sent to ${withdrawal.accountNumberMasked}.`
        );
      } else if (withdrawal.status === "processing") {
        Alert.alert(
          "Withdrawal Processing",
          `${formatMoney(withdrawal.amount)} has been submitted to Xendit. Your wallet will update when the payout status is confirmed.`
        );
      } else {
        Alert.alert(
          "Withdrawal Not Completed",
          withdrawal.failureReason ||
            "The payout was not completed. Your reserved amount will be released according to the payout status."
        );
      }
    } catch (error: any) {
      console.log("WITHDRAW ERROR:", error);

      Alert.alert(
        "Withdrawal Failed",
        error?.message || "Failed to create the GCash payout."
      );

      await loadWallet();
    } finally {
      setWithdrawLoading(false);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        loadWallet();
        setTimeout(() => loadWallet(), 1500);
        setTimeout(() => loadWallet(), 4000);
      }
    });

    return () => {
      subscription.remove();
      stopDepositPolling();
    };
  }, [loadWallet]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#15803D" />
        <Text className="text-green-700 font-semibold mt-3">
          Loading wallet...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-green-900 pt-14 pb-5 px-5 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text className="text-white text-2xl font-bold ml-4">
          Farmer Wallet
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
      >
        <View
          className="bg-green-800 rounded-3xl p-6 mb-4"
          style={{ elevation: 5 }}
        >
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center">
              <Ionicons name="wallet-outline" size={27} color="white" />
            </View>

            <View className="ml-3">
              <Text className="text-green-100 font-medium">
                Wallet Balance
              </Text>
              <Text className="text-green-100 text-xs mt-1">
                Actual payout is sent from FarmGate&apos;s Xendit account.
              </Text>
            </View>
          </View>

          <Text className="text-white text-4xl font-black mt-5">
            {formatMoney(wallet?.availableBalance || 0)}
          </Text>

          <Text className="text-green-100 text-xs mt-2">
            Available wallet balance
          </Text>
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4">
          <View className="flex-row mb-4">
            <View className="flex-1 mr-2 bg-gray-50 rounded-2xl p-4">
              <Text className="text-gray-500 text-xs">
                Pending Product Earnings
              </Text>
              <Text className="text-orange-600 text-xl font-black mt-2">
                {formatMoney(wallet?.pendingBalance || 0)}
              </Text>
              <Text className="text-gray-400 text-[11px] mt-1">
                Released when the order is Delivered
              </Text>
            </View>

            <View className="flex-1 ml-2 bg-gray-50 rounded-2xl p-4">
              <Text className="text-gray-500 text-xs">
                Pending Withdrawal
              </Text>
              <Text className="text-blue-600 text-xl font-black mt-2">
                {formatMoney(wallet?.reservedBalance || 0)}
              </Text>
            </View>
          </View>

          <View className="mt-4 bg-blue-50 rounded-xl p-3">
            <Text className="text-blue-800 text-xs">
              Pending Product Earnings are not withdrawable yet. They become part of your available balance after the order is marked Delivered.
            </Text>
          </View>

        </View>

        <View className="bg-white rounded-2xl p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="font-bold text-gray-800">
                COD Commission Reserve
              </Text>
              <Text className="text-gray-500 text-xs mt-1">
                Reserve used to cover the 3% COD commission before a COD order can be accepted.
              </Text>
            </View>
            <Text className="text-green-700 text-xl font-black">
              {formatMoney(wallet?.commissionReserveBalance || 0)}
            </Text>
          </View>

          <View className="flex-row mt-4">
            <View className="flex-1 mr-2 bg-gray-50 rounded-xl p-3">
              <Text className="text-gray-500 text-xs">Available Reserve</Text>
              <Text className="text-green-700 font-black mt-1">
                {formatMoney(wallet?.commissionReserveBalance || 0)}
              </Text>
            </View>
            <View className="flex-1 ml-2 bg-gray-50 rounded-xl p-3">
              <Text className="text-gray-500 text-xs">Held for COD</Text>
              <Text className="text-orange-600 font-black mt-1">
                {formatMoney(wallet?.commissionReserveHeld || 0)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setShowDepositModal(true)}
            disabled={depositLoading}
            className="bg-green-700 rounded-xl py-3 items-center mt-4"
          >
            {depositLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="add-circle-outline" size={20} color="white" />
                <Text className="text-white font-black ml-2">
                  Deposit Commission Reserve
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="w-11 h-11 rounded-full bg-blue-50 items-center justify-center">
                <Ionicons name="phone-portrait-outline" size={23} color="#2563EB" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="font-bold text-gray-800">
                  GCash Payout Account
                </Text>

                {payoutAccount ? (
                  <>
                    <Text className="text-gray-600 mt-1">
                      {payoutAccount.accountName}
                    </Text>
                    <Text className="text-gray-400 text-xs mt-1">
                      {payoutAccount.accountNumberMasked}
                    </Text>
                  </>
                ) : (
                  <Text className="text-gray-400 text-xs mt-1">
                    No GCash account saved yet.
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              onPress={openPayoutModal}
              className="bg-blue-50 px-3 py-2 rounded-xl"
            >
              <Text className="text-blue-700 font-semibold text-xs">
                {payoutAccount ? "Update" : "Add"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => {
            if (!payoutAccount) {
              openPayoutModal();
              return;
            }

            if (withdrawableAmount <= 0) {
              Alert.alert(
                "Cannot Withdraw",
                "Your withdrawable balance is ₱0.00. Settle outstanding COD deductions first."
              );
              return;
            }

            setShowWithdrawModal(true);
          }}
          disabled={withdrawLoading}
          className={`rounded-2xl py-4 mb-5 items-center justify-center ${
            withdrawableAmount > 0 && payoutAccount
              ? "bg-green-700"
              : "bg-gray-300"
          }`}
        >
          {withdrawLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <View className="flex-row items-center">
              <Ionicons name="cash-outline" size={22} color="white" />
              <Text className="text-white font-black ml-2">
                {payoutAccount
                  ? `Withdraw ${formatMoney(withdrawableAmount)}`
                  : "Add GCash to Withdraw"}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View className="bg-white rounded-2xl p-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-bold text-gray-800">
              Wallet History
            </Text>
            <Text className="text-gray-400 text-xs">
              {transactions.length} record(s)
            </Text>
          </View>

          {transactions.length === 0 ? (
            <View className="items-center py-10">
              <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
              <Text className="text-gray-400 mt-3">
                No wallet transactions yet.
              </Text>
            </View>
          ) : (
            transactions.map((transaction, index) => {
              const color = transactionColor(transaction);
              const isCredit = transaction.direction === "credit";

              return (
                <View
                  key={transaction.id}
                  className={`flex-row py-4 ${
                    index < transactions.length - 1
                      ? "border-b border-gray-100"
                      : ""
                  }`}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <Ionicons
                      name={transactionIcon(transaction) as any}
                      size={20}
                      color={color}
                    />
                  </View>

                  <View className="flex-1 ml-3">
                    <Text className="font-bold text-gray-800">
                      {transactionTitle(transaction)}
                    </Text>

                    <Text className="text-gray-500 text-xs mt-1">
                      {transaction.description}
                    </Text>

                    {transaction.orderNumber ? (
                      <Text className="text-green-700 text-xs font-semibold mt-1">
                        {transaction.orderNumber}
                      </Text>
                    ) : null}

                    <Text className="text-gray-400 text-[10px] mt-1">
                      {formatDate(transaction.createdAt)}
                    </Text>
                  </View>

                  <View className="items-end ml-2">
                    <Text
                      className="font-bold"
                      style={{
                        color,
                      }}
                    >
                      {isCredit ? "+" : "-"}
                      {formatMoney(Math.abs(transaction.amount))}
                    </Text>

                    <Text className="text-gray-400 text-[10px] mt-1">
                      {transaction.status}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showDepositModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDepositModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-center px-5">
          <View className="bg-white rounded-3xl p-6">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-xl font-black text-gray-800">
                Deposit Commission Reserve
              </Text>
              <TouchableOpacity onPress={() => setShowDepositModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-500 text-xs mb-2">
              Deposit amount
            </Text>
            <TextInput
              value={depositAmount}
              onChangeText={setDepositAmount}
              placeholder="100"
              keyboardType="decimal-pad"
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-3"
            />

            <Text className="text-gray-400 text-xs mb-5">
              Minimum deposit: ₱100.00. This is a separate COD commission reserve, not your farmer earnings balance.
            </Text>

            <TouchableOpacity
              onPress={handleDeposit}
              disabled={depositLoading}
              className="bg-green-700 rounded-xl py-4 items-center"
            >
              {depositLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-black">
                  Continue to GCash
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPayoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPayoutModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-center px-5">
          <View className="bg-white rounded-3xl p-6">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-xl font-black text-gray-800">
                GCash Payout Account
              </Text>
              <TouchableOpacity onPress={() => setShowPayoutModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-500 text-xs mb-2">
              GCash account name
            </Text>
            <TextInput
              value={accountName}
              onChangeText={setAccountName}
              placeholder="Juan Dela Cruz"
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4"
            />

            <Text className="text-gray-500 text-xs mb-2">
              GCash mobile number
            </Text>
            <TextInput
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder={
                payoutAccount?.accountNumberMasked || "09171234567"
              }
              keyboardType="phone-pad"
              maxLength={11}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4"
            />

            <Text className="text-gray-500 text-xs mb-2">
              Postal code
            </Text>
            <TextInput
              value={postalCode}
              onChangeText={setPostalCode}
              placeholder="3000"
              keyboardType="number-pad"
              maxLength={4}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-2"
            />

            <Text className="text-gray-400 text-[11px] mb-5">
              This information is used for the Xendit GCash payout request.
            </Text>

            <TouchableOpacity
              onPress={handleSavePayoutAccount}
              disabled={savingPayout}
              className="bg-green-700 rounded-xl py-4 items-center"
            >
              {savingPayout ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-black">
                  Save GCash Account
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showWithdrawModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-center px-5">
          <View className="bg-white rounded-3xl p-6">
            <Text className="text-xl font-black text-gray-800">
              Confirm Withdrawal
            </Text>

            <Text className="text-gray-500 mt-2">
              Send this available balance to:
            </Text>

            <View className="bg-gray-50 rounded-2xl p-4 mt-4">
              <Text className="font-bold text-gray-800">
                {payoutAccount?.accountName}
              </Text>
              <Text className="text-gray-500 mt-1">
                {payoutAccount?.accountNumberMasked}
              </Text>
            </View>

            <Text className="text-green-700 text-3xl font-black text-center mt-5">
              {formatMoney(withdrawableAmount)}
            </Text>


            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={() => setShowWithdrawModal(false)}
                className="flex-1 bg-gray-100 rounded-xl py-4 items-center"
              >
                <Text className="text-gray-700 font-bold">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleWithdraw}
                className="flex-1 bg-green-700 rounded-xl py-4 items-center"
              >
                <Text className="text-white font-black">
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
