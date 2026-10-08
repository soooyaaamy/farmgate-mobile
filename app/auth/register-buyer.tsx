import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  useWindowDimensions,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import AntDesign from "@expo/vector-icons/AntDesign";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  sanitizePhoneInput,
  toE164Phone,
  validateDetails,
  validatePasswords,
  getRegisterErrorMessage,
} from "../../utils/validators";
import { registerUser } from "../../src/services/authService";
import { saveUserToFirestore } from "../../src/services/firestoreService";
import { sendBrandedVerificationEmail } from "../../src/services/emailVerificationService";
import { uploadValidIDAsync } from "../../src/services/cloudinaryValidIDService";
import { useToast } from "../../context/ToastContext";
import { auth } from "../../FirebaseConfig";
import { reload } from "firebase/auth";

const RegisterBuyer = () => {
  const router = useRouter();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validID, setValidID] = useState< string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; message: string; success?: boolean } | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const nextStep = () => {
    const validationError = validateDetails({ fullName, email, phone });
    if (validationError) {
      showToast(validationError);
      return;
    }
    setStep(2);
  };

  const startEmailVerification = async () => {
    const validationError = validatePasswords({ password, confirmPassword });

    if (validationError) {
      showToast(validationError);
      return;
    }

    try {
      setLoading(true);
      let user = auth.currentUser;
      if (user?.email?.toLowerCase() !== email.trim().toLowerCase()) {
        user = await registerUser(fullName.trim(), email.trim(), password);
      } else {
        await reload(user);
      }

      if (user.emailVerified) {
        setStep(4);
        showToast("Your email is already verified.");
        return;
      }

      const result = await sendBrandedVerificationEmail();
      if (result.alreadyVerified) {
        setStep(4);
        showToast("Your email is already verified.");
        return;
      }
      setStep(3);
      showToast(`Verification link sent to ${email.trim()}.`);
    } catch (error: any) {
      console.log("Email verification error:", error);
      showToast(getRegisterErrorMessage(error?.code));
    } finally {
      setLoading(false);
    }
  };

  const checkEmailVerification = async () => {
    const user = auth.currentUser;
    if (!user || user.email?.toLowerCase() !== email.trim().toLowerCase()) {
      showToast("Restart registration to send a verification link.");
      setStep(2);
      return;
    }

    try {
      setCheckingEmail(true);
      await reload(user);
      if (!user.emailVerified) {
        showToast("Verify your email using the link we sent, then try again.");
        return;
      }
      setStep(4);
      showToast("Email verified. Continue registration.");
    } catch (error) {
      console.error("Email verification check failed:", error);
      showToast("Could not check email verification. Please try again.");
    } finally {
      setCheckingEmail(false);
    }
  };

  const pickImage = async () => {
    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
      });
    if (!result.canceled) {
      setValidID(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    const validationError = validateDetails({ fullName, email, phone }) ||
      validatePasswords({ password, confirmPassword });

    if (validationError) {
      showToast(validationError);
      return;
    }

    if (!validID) {
      showToast("Upload a clear photo of your valid ID.");
      return;
    }

    if (!agreed) {
      showToast("Read and accept the User Agreement and Privacy Policy to continue.");
      return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user || user.email?.toLowerCase() !== email.trim().toLowerCase() || !user.emailVerified) {
        setLoading(false);
        setStep(3);
        showToast("Verify your email before submitting your registration.");
        return;
      }

      // STORAGE
      const validIDUrl =
        await uploadValidIDAsync(validID);

      // FIRESTORE
      await saveUserToFirestore(user.uid, {
        uid: user.uid,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: toE164Phone(phone),
        role: "buyer",
        status: "pending",
        validID: validIDUrl,
        createdAt: new Date(),
      });
      
      setLoading(false);
      setDialog({
        title: "Registration submitted",
        message: "Your buyer account is pending admin approval. You can sign in after it has been approved.",
        success: true,
      });

    } catch (error: any) {
      setLoading(false);
      console.log("Registration error:", error);
      const code = error?.code;
      if (code === "auth/email-already-in-use" || code === "auth/invalid-email") {
        setStep(1);
      }
      showToast(getRegisterErrorMessage(code));
    }
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1, minHeight: height }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
    <View className="flex-1" style={{ minHeight: height, backgroundColor: "#14532d" }}>
      <StatusBar barStyle="light-content" backgroundColor="#14532d" />
      <View className="items-center px-6 pt-20 pb-24">
        <Image
          source={require("../../assets/Farmgate-logos/farmgate-logo.png")}
          className="w-16 h-16 mb-3"
          resizeMode="contain"
        />
        <Text className="text-white text-2xl font-bold tracking-wide">
          FARMGATE DIRECT
        </Text>
        <Text className="text-green-100 text-sm mt-2">
          Buyer registration
        </Text>
      </View>

      <View className="flex-1 justify-start bg-white rounded-t-[40px] px-5 pt-8 pb-10 -mt-5">
        <View className="mb-10">
          <View className="flex-row items-center justify-between">
            {[
              { label: "Details", icon: "account-outline" as const },
              { label: "Password", icon: "lock-outline" as const },
              { label: "Email", icon: "email-outline" as const },
              { label: "ID", icon: "card-account-details-outline" as const },
            ].map((item, index) => {
              const itemStep = index + 1;
              const active = step >= itemStep;
              return (
                <View key={item.label} className="items-center flex-1">
                  <View
                    className="w-9 h-9 rounded-full items-center justify-center"
                    style={{ backgroundColor: active ? "#14532d" : "#f3f4f6" }}
                  >
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={19}
                      color={active ? "#ffffff" : "#9ca3af"}
                    />
                  </View>
                  <Text className="text-xs mt-1" style={{ color: active ? "#14532d" : "#9ca3af" }}>
                    {item.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
        <View>
          {step === 1 ? (
          <>
          <Text className="text-gray-700 text-sm font-semibold mb-2">
            Full Name
          </Text>

          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            placeholderTextColor="#9ca3af"
            className="bg-white border border-gray-200 rounded-[5px] px-4 py-4 mb-4 text-gray-800"
            style={{ minHeight: 50 }}
          />

          <Text className="text-gray-700 text-sm font-semibold mb-2">
            Email
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter your email"
            placeholderTextColor="#9ca3af"
            className="bg-white border border-gray-200 rounded-[5px] px-4 py-4 mb-4 text-gray-800"
            style={{ minHeight: 50 }}
          />

          <Text className="text-gray-700 text-sm font-semibold mb-2">
            Phone No.
          </Text>

          <View
            className="flex-row items-center bg-white border border-gray-200 rounded-[5px] mb-4"
            style={{ minHeight: 50 }}
          >
            <View className="px-4 self-stretch justify-center border-r border-gray-200">
              <Text className="text-gray-700 font-semibold">+63</Text>
            </View>
            <TextInput
              value={phone}
              onChangeText={(value) => setPhone(sanitizePhoneInput(value))}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="9XX XXX XXXX"
              placeholderTextColor="#9ca3af"
              className="flex-1 px-3 py-4 text-gray-800"
            />
          </View>
          </>
          ) : step === 2 ? (
          <>
          <Text className="text-gray-700 text-sm font-semibold mb-2">
            Password
          </Text>
          <View className="flex-row items-center border border-gray-200 rounded-[5px] px-1 mb-4" style={{ minHeight: 50 }}>
            <TextInput
              key={`password-${showPassword ? "visible" : "hidden"}`}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              placeholder="Enter your password"
              placeholderTextColor="#9ca3af"
              className="flex-1 px-3 py-4 text-gray-800"
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              onPress={() => setShowPassword((visible) => !visible)}
              className="px-3 py-2"
            >
              <MaterialCommunityIcons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text className="text-gray-700 text-sm font-semibold mb-2">
            Confirm Password
          </Text>

          <View className="flex-row items-center border border-gray-200 rounded-[5px] px-1 mb-4" style={{ minHeight: 50 }}>
            <TextInput
              key={`confirm-password-${showConfirmPassword ? "visible" : "hidden"}`}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              textContentType="newPassword"
              placeholder="Confirm your password"
              placeholderTextColor="#9ca3af"
              className="flex-1 px-3 py-4 text-gray-800"
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
              onPress={() => setShowConfirmPassword((visible) => !visible)}
              className="px-3 py-2"
            >
              <MaterialCommunityIcons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={21} color="#6b7280" />
            </TouchableOpacity>
          </View>
          </>
          ) : step === 3 ? (
          <View className="items-center py-5">
            <MaterialCommunityIcons name="email-check-outline" size={48} color="#14532d" />
            <Text className="text-gray-800 text-base font-semibold text-center mt-4">
              Check your inbox
            </Text>
            <Text className="text-gray-600 text-sm text-center mt-2">
              Open the verification link sent to {email.trim()}, then return here to continue.
            </Text>
            <TouchableOpacity
              onPress={async () => {
                const user = auth.currentUser;
                if (!user || user.email?.toLowerCase() !== email.trim().toLowerCase()) {
                  showToast("Restart registration to resend the verification link.");
                  return;
                }
                try {
                  setLoading(true);
                  const result = await sendBrandedVerificationEmail();
                  if (result.alreadyVerified) {
                    setStep(4);
                    showToast("Your email is already verified.");
                  } else {
                    showToast("A new verification link has been sent.");
                  }
                } catch (error: any) {
                  showToast(getRegisterErrorMessage(error?.code));
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="mt-5"
            >
              <Text className="font-semibold" style={{ color: "#14532d" }}>Resend verification link</Text>
            </TouchableOpacity>
          </View>
          ) : (
          <>
          <View className="flex-row items-start rounded-[10px] bg-green-50 p-3 mb-5">
            <MaterialCommunityIcons name="shield-check-outline" size={21} color="#14532d" />
            <Text className="flex-1 ml-2 text-sm text-gray-600">
              Upload a clear photo of your valid ID. Your account will be reviewed before you can sign in.
            </Text>
          </View>
          <Text className="text-gray-700 text-sm font-semibold mb-2">
            Upload Valid ID
          </Text>

          <TouchableOpacity
            onPress={pickImage}
            className="bg-gray-50 border border-gray-200 rounded-[10px] py-4 px-4 mb-4 flex-row items-center"
          >
            {validID ? (
              <View className="flex-row items-center flex-1">
                <MaterialCommunityIcons name="check-circle" size={23} color="#14532d" />
                <Text className="font-semibold ml-2 flex-1" style={{ color: "#14532d" }}>
                  ID image selected
                </Text>
                <Text className="text-gray-500 text-sm">Change</Text>
              </View>
            ) : (
              <>
                <MaterialCommunityIcons name="cloud-upload-outline" size={23} color="#14532d" />
                <Text className="text-gray-600 ml-2">Choose ID image</Text>
              </>
            )}
          </TouchableOpacity>

          {/* USER AGREEMENT */}
          <TouchableOpacity
            onPress={() => setAgreed(!agreed)}
            activeOpacity={0.8}
            className="flex-row items-start mt-1 mb-2"
          >
            <View
              className={`w-5 h-5 rounded border items-center justify-center mr-2 mt-0.5 ${
                agreed
                  ? "bg-[#14532d] border-[#14532d]"
                  : "border-gray-300"
              }`}
            >
              {agreed ? (
                <AntDesign
                  name="check"
                  size={14}
                  color="white"
                />
              ) : null}
            </View>

            <Text className="text-gray-600 text-xs flex-1">
              I have read and agree to the{" "}
              <Text
                className="font-semibold underline"
                style={{ color: "#14532d" }}
                onPress={() =>
                  setShowAgreement(true)
                }
              >
                User Agreement and Privacy Policy
              </Text>
              .
            </Text>
          </TouchableOpacity>
          </>
          )}
        </View>

        <View className="pt-3">
          <View className="flex-row">
            {step > 1 && (
              <TouchableOpacity
                onPress={() => setStep((currentStep) => currentStep - 1)}
                className="flex-1 items-center justify-center rounded-[10px] py-3.5 mr-3 border border-gray-300"
                activeOpacity={0.85}
              >
                <Text className="font-semibold" style={{ color: "#14532d" }}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              disabled={loading || checkingEmail}
              onPress={
                step === 1
                  ? nextStep
                  : step === 2
                    ? startEmailVerification
                    : step === 3
                      ? checkEmailVerification
                      : handleSubmit
              }
              className="flex-1 items-center justify-center rounded-[5px] py-3.5"
              style={{ backgroundColor: "#14532d" }}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-center font-bold">
                  {step === 1 ? "Continue" : step === 2 ? "Send verification link" : step === 3 ? checkingEmail ? "Checking..." : "I’ve verified my email" : "Submit registration"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <Text className="text-center text-gray-500 mt-4">
            Already have an account?{" "}
            <Text
              className="font-semibold"
              style={{ color: "#14532d" }}
              onPress={() =>
                router.push("/auth/login")
              }
            >
              Sign in
            </Text>
          </Text>
        </View>
      </View>

      <Modal
        visible={dialog !== null}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <View className="flex-1 bg-black/50 justify-center px-6">
          <View className="bg-white rounded-[10px] p-6">
            {!dialog?.success && (
              <View className="w-12 h-12 rounded-full bg-green-50 items-center justify-center mb-4">
                <MaterialCommunityIcons
                  name="information-outline"
                  size={28}
                  color="#14532d"
                />
              </View>
            )}
            <Text className="text-gray-900 text-lg font-bold mb-2">{dialog?.title}</Text>
            <Text className="text-gray-600 text-sm leading-5">{dialog?.message}</Text>
            <TouchableOpacity
              onPress={() => {
                const success = dialog?.success;
                setDialog(null);
                if (success) router.replace("/auth/login");
              }}
              className="items-center py-3 rounded-[10px] mt-5"
              style={{ backgroundColor: "#14532d" }}
            >
              <Text className="text-white font-semibold">{dialog?.success ? "Continue to sign in" : "Got it"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* USER AGREEMENT MODAL */}
      <Modal
        visible={showAgreement}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() =>
          setShowAgreement(false)
        }
      >
        <View className="flex-1 bg-black/50 justify-center px-6">
          <View className="bg-white rounded-[10px] p-6 max-h-[80%]">
            <Text className="text-lg font-bold mb-3" style={{ color: "#14532d" }}>
              User Agreement and Privacy Policy
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-gray-700 text-xs mb-2">
                1. Account Registration{"\n"}
                You must provide true and complete information during
                registration. One account per person only.
              </Text>

              <Text className="text-gray-700 text-xs mb-2">
                2. Identity Verification{"\n"}
                A valid government-issued ID is required. Your account
                stays pending and you cannot log in until an admin
                verifies and approves your registration.
              </Text>

              <Text className="text-gray-700 text-xs mb-2">
                3. Data Privacy & Your Security{"\n"}
                Your trust matters to us. Your name, contact details, and
                valid ID are collected solely to verify your identity and
                keep all transactions safe. Your information is kept
                confidential, stored securely, and will never be 
                shared, in line with the Data Privacy
                Act of 2012 (RA 10173).
              </Text>

              <Text className="text-gray-700 text-xs mb-2">
                4. Proper Use{"\n"}
                You agree to use FarmGate Direct only for lawful buying
                and selling. Fraud, fake listings, or misuse may lead to
                suspension or banning of your account.
              </Text>

              <Text className="text-gray-700 text-xs mb-4">
                5. Approval Decision{"\n"}
                The admin may approve or reject any registration. Rejected
                applicants will be notified and cannot log in.
              </Text>
            </ScrollView>

            <TouchableOpacity
              onPress={() =>
                setShowAgreement(false)
              }
              className="py-3 rounded-[10px] mt-4"
              style={{ backgroundColor: "#14532d" }}
            >
              <Text className="text-white text-center font-bold">
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
    </ScrollView>
  );
};

export default RegisterBuyer;