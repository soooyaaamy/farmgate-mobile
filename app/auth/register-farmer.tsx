import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  StatusBar,
  Image,
  useWindowDimensions,
} from "react-native";

import * as ImagePicker
  from "expo-image-picker";

import { useRouter }
  from "expo-router";

import AntDesign
  from "@expo/vector-icons/AntDesign";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Dropdown }
  from "react-native-element-dropdown";

import {
  registerUser,
} from "../../src/services/authService";
import { auth } from "../../FirebaseConfig";
import { reload } from "firebase/auth";

import {
  saveUserToFirestore,
} from "../../src/services/firestoreService";
import { sendBrandedVerificationEmail } from "../../src/services/emailVerificationService";

import {
  uploadValidIDAsync,
} from "../../src/services/cloudinaryValidIDService";

import {
  sanitizePhoneInput,
  toE164Phone,
  validateDetails,
  validatePasswords,
  validateFarm,
  getRegisterErrorMessage,
} from "../../utils/validators";
import { useToast } from "../../context/ToastContext";

const PSGC_BASE =
  "https://psgc.gitlab.io/api";

type InputProps = {
  label: string;
  value: string;
  setter: (value: string) => void;
  secure?: boolean;
  prefix?: string;
  maxLength?: number;
  placeholder?: string;
};

type UploadBoxProps = {
  label: string;
  value: string | null;
  setter: () => void;
};

const RegisterFarmer = () => {

  const router =
    useRouter();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();

  const [step, setStep] =
    useState(1);

  const [loading, setLoading] =
    useState(false);

  // ================= STEP 1 =================
  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  // ================= STEP 2 =================
  const [farmName, setFarmName] =
    useState("");

  const [barangay, setBarangay] =
    useState("");

  const [
    municipality,
    setMunicipality,
  ] = useState("");

  const [province, setProvince] =
    useState("");

  const [validID, setValidID] =
    useState<string | null>(null);

  // ================= USER AGREEMENT =================
  const [agreed, setAgreed] =
    useState(false);

  const [showAgreement, setShowAgreement] =
    useState(false);

  const [dialog, setDialog] =
    useState<{ title: string; message: string; success?: boolean } | null>(null);

  const [checkingEmail, setCheckingEmail] =
    useState(false);

  // ================= LOCATION (FIXED: Central Luzon / Bulacan, like Add Address) =================
  const [locationLoading, setLocationLoading] =
    useState(true);

  const [cities, setCities] =
    useState<any[]>([]);

  const [barangays, setBarangays] =
    useState<any[]>([]);

  const [
    selectedRegion,
    setSelectedRegion,
  ] = useState<any>(null);

  const [
    selectedProvince,
    setSelectedProvince,
  ] = useState<any>(null);

  const [
    selectedCity,
    setSelectedCity,
  ] = useState<any>(null);

  const [
    selectedBarangay,
    setSelectedBarangay,
  ] = useState<any>(null);

  const [cityFocus, setCityFocus] =
    useState(false);

  const [barangayFocus, setBarangayFocus] =
    useState(false);

  // ================= LOAD FIXED LOCATION =================
  useEffect(() => {

    loadFixedLocation();

  }, []);

  const loadFixedLocation =
    async () => {

      try {

        setLocationLoading(true);

        // STEP 1: GET ALL REGIONS
        const regionResponse =
          await fetch(
            `${PSGC_BASE}/regions`
          );

        if (!regionResponse.ok) {
          throw new Error(
            "Failed to fetch regions"
          );
        }

        const regions =
          await regionResponse.json();

        // FIND CENTRAL LUZON
        const centralLuzon =
          regions.find(
            (region: any) =>
              region.name
                ?.trim()
                .toLowerCase() ===
              "central luzon"
          );

        if (!centralLuzon) {
          throw new Error(
            "Central Luzon not found"
          );
        }

        setSelectedRegion(
          centralLuzon
        );

        // STEP 2: GET PROVINCES UNDER CENTRAL LUZON
        const provinceResponse =
          await fetch(
            `${PSGC_BASE}/regions/${centralLuzon.code}/provinces`
          );

        if (!provinceResponse.ok) {
          throw new Error(
            "Failed to fetch provinces"
          );
        }

        const provincesData =
          await provinceResponse.json();

        // FIND BULACAN
        const bulacan =
          provincesData.find(
            (province: any) =>
              province.name
                ?.trim()
                .toLowerCase() ===
              "bulacan"
          );

        if (!bulacan) {
          throw new Error(
            "Bulacan not found"
          );
        }

        setSelectedProvince(
          bulacan
        );

        setProvince(
          bulacan.name
        );

        // STEP 3: LOAD BULACAN CITIES/MUNICIPALITIES
        await loadCities(
          bulacan.code
        );

      } catch (error) {

        console.log(
          "Location loading error:",
          error
        );

        showToast("Failed to load Bulacan locations. Please try again.");

      } finally {

        setLocationLoading(false);

      }
    };

  // ================= LOAD CITIES =================
  const loadCities =
    async (
      provinceCode: string
    ) => {

      try {

        const response =
          await fetch(
            `${PSGC_BASE}/provinces/${provinceCode}/cities-municipalities`
          );

        if (!response.ok) {
          throw new Error(
            "Failed to fetch cities"
          );
        }

        const data =
          await response.json();

        setCities(data);

      } catch (error) {

        console.log(
          "City loading error:",
          error
        );

      }
    };

  // ================= LOAD BARANGAYS =================
  const loadBarangays =
    async (
      cityCode: string
    ) => {

      try {

        const response =
          await fetch(
            `${PSGC_BASE}/cities-municipalities/${cityCode}/barangays`
          );

        if (!response.ok) {
          throw new Error(
            "Failed to fetch barangays"
          );
        }

        const data =
          await response.json();

        setBarangays(data);

      } catch (error) {

        console.log(
          "Barangay loading error:",
          error
        );

      }
    };

  // ================= PICK IMAGE =================
  const pickImage = async (
    setter: React.Dispatch<
      React.SetStateAction<
        string | null
      >
    >
  ) => {

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
      });

    if (!result.canceled) {

      setter(
        result.assets[0].uri
      );

    }
  };

  // ================= NEXT STEP =================
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

  // ================= PREVIOUS STEP =================
  const prevStep = () => {

    if (step > 1) {

      setStep(step - 1);

    }
  };

  // ================= REGISTER =================
  const handleRegister =
    async () => {

      if (locationLoading) {

        showToast("Farm locations are still loading. Try again in a moment.");

        return;
      }

      const validationError =
        validateDetails({ fullName, email, phone }) ||
        validatePasswords({ password, confirmPassword }) ||
        validateFarm({ farmName, selectedCity, selectedBarangay });

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
        if (
          !user ||
          user.email?.toLowerCase() !== email.trim().toLowerCase() ||
          !user.emailVerified
        ) {
          setLoading(false);
          setStep(3);
          showToast("Verify your email before submitting your registration.");
          return;
        }

        // CLOUDINARY
        const validIDUrl =
          await uploadValidIDAsync(
            validID
          );

        // FIRESTORE
        await saveUserToFirestore(
          user.uid,
          {
            uid: user.uid,
            fullName: fullName.trim(),
            email: email.trim(),
            phone: toE164Phone(phone),
            role: "farmer",
            status: "pending",
            farmName: farmName.trim(),
            region:
              selectedRegion?.name ||
              "Central Luzon",
            barangay,
            municipality,
            province,
            validID:
              validIDUrl,
            createdAt:
              new Date(),
          }
        );

        setLoading(false);

        setDialog({
          title: "Registration submitted",
          message: "Your farmer account is pending admin approval. You can sign in after it has been approved.",
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

  // ================= STEP INDICATOR =================
  const StepIndicator =
    () => (

      <View className="flex-row justify-between mt-4 mb-1">
        {[
          { label: "Details", icon: "account-outline" as const },
          { label: "Password", icon: "lock-outline" as const },
          { label: "Email", icon: "email-outline" as const },
          { label: "Farm", icon: "tractor-variant" as const },
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
                  color={active ? "#ffffff" : "#d1d5db"}
                />
              </View>
              <Text
                className="text-xs mt-1"
                style={{ color: active ? "#14532d" : "#9ca3af" }}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    );

  return (

    <ScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1, minHeight: height }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
    <View className="flex-1" style={{ minHeight: height, backgroundColor: "#14532d" }}>
      <StatusBar barStyle="light-content" backgroundColor="#14532d" />

      {/* HEADER */}
      <View className="items-center px-6 pt-20 pb-24">

        <Image
          source={require("../../assets/Farmgate-logos/farmgate-logo.png")}
          className="w-16 h-16 mb-3"
          resizeMode="contain"
        />

        <Text className="text-white text-2xl font-bold tracking-wide">
          FARMGATE DIRECT
        </Text>

        <Text className="text-green-100 text-sm mt-2">Farmer registration</Text>

      </View>

      {/* WHITE CARD */}
      <View className="flex-1 justify-start bg-white rounded-t-[40px] px-5 pt-8 pb-10 -mt-4">
        <View className="mb-10">
          <StepIndicator />
        </View>

        {step === 1 ? (

          <View>

            <Input
              label="Full Name"
              value={fullName}
              setter={setFullName}
            />

            <Input
              label="Email"
              value={email}
              setter={setEmail}
            />

            <Input
              label="Phone No."
              value={phone}
              setter={(value) => setPhone(sanitizePhoneInput(value))}
              prefix="+63"
              maxLength={10}
              placeholder="9XX XXX XXXX"
            />

          </View>

        ) : step === 2 ? (
          <View>
            <Input
              label="Password"
              value={password}
              setter={setPassword}
              secure
            />

            <Input
              label="Confirm Password"
              value={confirmPassword}
              setter={setConfirmPassword}
              secure
            />
          </View>
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
              <Text className="font-semibold" style={{ color: "#14532d" }}>
                Resend verification link
              </Text>
            </TouchableOpacity>
          </View>
        ) : (

          <View>

            <Input
              label="Farm Name"
              value={farmName}
              setter={setFarmName}
            />

            {/* REGION (FIXED - same design as Add Address) */}
            <Text className="text-gray-700 text-sm font-semibold mb-2">
              Region
            </Text>

            <View
              className="justify-center rounded-[10px] px-4 mb-4"
              style={{
                backgroundColor: "#f9fafb",
                borderWidth: 1,
                borderColor: "#e5e7eb",
                height: 56,
              }}
            >
              <Text className="text-gray-800 text-[5px] font-medium">
                {locationLoading
                  ? "Loading region..."
                  : selectedRegion?.name ||
                    "Central Luzon"}
              </Text>
            </View>

            {/* PROVINCE (FIXED - same design as Add Address) */}
            <Text className="text-gray-700 text-sm font-semibold mb-2">
              Province
            </Text>

            <View
              className="justify-center rounded-[10px] px-4 mb-4"
              style={{
                backgroundColor: "#f9fafb",
                borderWidth: 1,
                borderColor: "#e5e7eb",
                height: 56,
              }}
            >
              <Text className="text-gray-800 text-[5px] font-medium">
                {locationLoading
                  ? "Loading province..."
                  : selectedProvince?.name ||
                    "Bulacan"}
              </Text>
            </View>

            {/* CITY / MUNICIPALITY - same design as Add Address */}
            <Text className="text-gray-700 text-sm font-semibold mb-2">
              City / Municipality
            </Text>

            <Dropdown
              mode="modal"
              maxHeight={440}
              dropdownPosition="auto"
              keyboardAvoiding
              disable={
                !selectedProvince ||
                locationLoading
              }
              style={{
                backgroundColor: selectedCity ? "#ffffff" : "#f9fafb",
                borderRadius: 10,
                paddingHorizontal: 14,
                height: 56,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: cityFocus
                  ? "#14532d"
                  : selectedCity
                    ? "#14532d"
                    : "#e5e7eb",
                opacity:
                  selectedProvince &&
                  !locationLoading
                    ? 1
                    : 0.6,
                shadowColor: cityFocus ? "#14532d" : "transparent",
                shadowOpacity: cityFocus ? 0.12 : 0,
                shadowRadius: 8,
                elevation: cityFocus ? 3 : 0,
              }}
              containerStyle={{
                borderRadius: 10,
                backgroundColor: "#ffffff",
                paddingVertical: 6,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
              }}
              placeholderStyle={{
                fontSize: 5,
                color: "#9CA3AF",
              }}
              selectedTextStyle={{
                fontSize: 15,
                color: "#111827",
                fontWeight: "500",
              }}
              inputSearchStyle={{
                height: 42,
                borderRadius: 8,
                backgroundColor: "#f9fafb",
                fontSize: 14,
                borderWidth: 0,
                paddingHorizontal: 12,
              }}
              itemContainerStyle={{
                borderRadius: 8,
                marginHorizontal: 6,
              }}
              itemTextStyle={{
                fontSize: 15,
                color: "#374151",
              }}
              data={cities}
              labelField="name"
              valueField="code"
              placeholder={
                locationLoading
                  ? "Loading Bulacan locations..."
                  : !cityFocus && !selectedCity
                    ? "Select City / Municipality"
                    : "..."
              }
              search
              searchPlaceholder="Search city or municipality..."
              value={
                selectedCity?.code
              }
              activeColor="#DCFCE7"
              onFocus={() => setCityFocus(true)}
              onBlur={() => setCityFocus(false)}
              renderItem={(item: any) => {
                const isSelected = item.code === selectedCity?.code;
                return (
                  <View
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      backgroundColor: isSelected ? "#DCFCE7" : "transparent",
                      borderRadius: 8,
                      marginHorizontal: 6,
                      marginVertical: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        color: isSelected ? "#14532d" : "#374151",
                        fontWeight: isSelected ? "600" : "400",
                      }}
                    >
                      {item.name}
                    </Text>
                  </View>
                );
              }}
              flatListProps={{
                ListEmptyComponent: (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <Text style={{ color: "#9CA3AF", fontSize: 13 }}>
                      No cities found
                    </Text>
                  </View>
                ),
              }}
              onChange={(item) => {

                setSelectedCity(
                  item
                );

                setMunicipality(
                  item.name
                );

                setSelectedBarangay(
                  null
                );

                setBarangay("");

                setBarangays([]);

                setCityFocus(false);

                loadBarangays(
                  item.code
                );
              }}
            />

            {/* BARANGAY - same design as Add Address */}
            <Text className="text-gray-700 text-sm font-semibold mb-2">
              Barangay
            </Text>

            <Dropdown
              mode="modal"
              maxHeight={440}
              dropdownPosition="auto"
              keyboardAvoiding
              disable={
                !selectedCity
              }
              style={{
                backgroundColor: !selectedCity
                  ? "#f3f4f6"
                  : selectedBarangay
                    ? "#ffffff"
                    : "#f9fafb",
                borderRadius: 10,
                paddingHorizontal: 14,
                height: 56,
                marginBottom: 18,
                borderWidth: 1,
                borderColor: barangayFocus
                  ? "#14532d"
                  : selectedBarangay
                    ? "#14532d"
                    : "#e5e7eb",
                opacity:
                  selectedCity
                    ? 1
                    : 0.6,
                shadowColor: barangayFocus ? "#14532d" : "transparent",
                shadowOpacity: barangayFocus ? 0.12 : 0,
                shadowRadius: 8,
                elevation: barangayFocus ? 3 : 0,
              }}
              containerStyle={{
                borderRadius: 10,
                backgroundColor: "#ffffff",
                paddingVertical: 6,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
              }}
              placeholderStyle={{
                fontSize: 15,
                color: "#9CA3AF",
              }}
              selectedTextStyle={{
                fontSize: 15,
                color: "#111827",
                fontWeight: "500",
              }}
              inputSearchStyle={{
                height: 42,
                borderRadius: 8,
                backgroundColor: "#f9fafb",
                fontSize: 14,
                borderWidth: 0,
                paddingHorizontal: 12,
              }}
              itemContainerStyle={{
                borderRadius: 8,
                marginHorizontal: 6,
              }}
              itemTextStyle={{
                fontSize: 15,
                color: "#374151",
              }}
              data={barangays}
              labelField="name"
              valueField="code"
              placeholder={
                !selectedCity
                  ? "Select a city first"
                  : !barangayFocus && !selectedBarangay
                    ? "Select Barangay"
                    : "..."
              }
              search
              searchPlaceholder="Search barangay..."
              value={
                selectedBarangay?.code
              }
              activeColor="#DCFCE7"
              onFocus={() => setBarangayFocus(true)}
              onBlur={() => setBarangayFocus(false)}
              renderItem={(item: any) => {
                const isSelected = item.code === selectedBarangay?.code;
                return (
                  <View
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      backgroundColor: isSelected ? "#DCFCE7" : "transparent",
                      borderRadius: 8,
                      marginHorizontal: 6,
                      marginVertical: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        color: isSelected ? "#14532d" : "#374151",
                        fontWeight: isSelected ? "600" : "400",
                      }}
                    >
                      {item.name}
                    </Text>
                  </View>
                );
              }}
              flatListProps={{
                ListEmptyComponent: (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <Text style={{ color: "#9CA3AF", fontSize: 13 }}>
                      {!selectedCity ? "Select a city first" : "No barangays found"}
                    </Text>
                  </View>
                ),
              }}
              onChange={(item) => {

                setSelectedBarangay(
                  item
                );

                setBarangay(
                  item.name
                );

                setBarangayFocus(false);
              }}
            />

            <View className="flex-row items-start rounded-[10px] bg-green-50 p-3 mb-4">
              <MaterialCommunityIcons name="shield-check-outline" size={21} color="#14532d" />
              <Text className="flex-1 ml-2 text-sm text-gray-600">
                Upload a clear photo of your valid ID. Your account will be reviewed before you can sign in.
              </Text>
            </View>

            <UploadBox
              label="Valid ID"
              value={validID}
              setter={() =>
                pickImage(
                  setValidID
                )
              }
            />

            {/* USER AGREEMENT */}
            <TouchableOpacity
              onPress={() =>
                setAgreed(!agreed)
              }
              activeOpacity={0.8}
              className="flex-row items-start mb-2 mt-2"
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

          </View>

        )}

        {/* BUTTONS */}
        <View className="pt-3 w-full">

          <View className="flex-row">
            {step > 1 && (
              <TouchableOpacity
                onPress={prevStep}
                className="items-center justify-center border border-gray-300 py-3.5 rounded-[5px] flex-1 mr-3"
              >
                <Text className="text-center font-semibold" style={{ color: "#14532d" }}>
                  Back
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              disabled={loading || checkingEmail}
              onPress={step === 1 ? nextStep : step === 2 ? startEmailVerification : step === 3 ? checkEmailVerification : handleRegister}
              className="items-center justify-center py-3.5 rounded-[5px] flex-1"
              style={{ backgroundColor: "#14532d" }}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-center font-bold">
                  {step === 1
                    ? "Continue"
                    : step === 2
                      ? "Send verification link"
                      : step === 3
                        ? checkingEmail
                          ? "Checking..."
                          : "I’ve verified my email"
                        : "Submit registration"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <Text className="text-center text-gray-500 mt-3">
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
          <View className="bg-white rounded-[5px] p-6">
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
              className="items-center py-3 rounded-[5px] mt-5"
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
          <View className="bg-white rounded-[5px] p-6 max-h-[80%]">
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
                confidential, stored securely, and will never be sold or
                shared without your consent, in line with the Data Privacy
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
              className="py-3 rounded-[5px] mt-4"
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

// ================= INPUT =================
const Input = ({
  label,
  value,
  setter,
  secure,
  prefix,
  maxLength,
  placeholder,
}: InputProps) => {
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <>
      <Text className="text-gray-700 text-sm font-semibold mb-2">
        {label}
      </Text>
      <View className="flex-row items-center bg-white border border-gray-200 rounded-[5px] px-1 mb-4" style={{ minHeight: 50 }}>
        {prefix && (
          <View className="px-4 self-stretch justify-center border-r border-gray-200">
            <Text className="text-gray-700 font-semibold">{prefix}</Text>
          </View>
        )}
        <TextInput
          key={`${label}-${secure && !passwordVisible ? "hidden" : "visible"}`}
          value={value}
          onChangeText={setter}
          secureTextEntry={Boolean(secure && !passwordVisible)}
          textContentType={secure ? "newPassword" : "none"}
          maxLength={maxLength}
          placeholder={placeholder ?? `Enter ${label.toLowerCase()}`}
          placeholderTextColor="#9ca3af"
          autoCapitalize={label === "Email" ? "none" : undefined}
          autoCorrect={label === "Email" ? false : undefined}
          keyboardType={
            label === "Email"
              ? "email-address"
              : label === "Phone No."
                ? "phone-pad"
                : "default"
          }
          className="flex-1 px-3 py-4 text-gray-800"
        />
        {secure && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
            onPress={() => setPasswordVisible((visible) => !visible)}
            className="px-3 py-2"
          >
            <MaterialCommunityIcons
              name={passwordVisible ? "eye-off-outline" : "eye-outline"}
              size={21}
              color="#6b7280"
            />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
};

// ================= IMAGE UPLOAD =================
const UploadBox = ({
  label,
  value,
  setter,
}: UploadBoxProps) => (

  <>

    <Text className="text-gray-700 text-sm font-semibold mb-2">
      {label}
    </Text>

    <TouchableOpacity
      onPress={setter}
      className="bg-gray-50 border border-gray-200 rounded-[10px] py-4 px-4 mb-4 flex-row items-center"
    >

      {value ? (

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
          <Text className="text-gray-600 ml-2">Choose {label}</Text>
        </>
      )}

    </TouchableOpacity>

  </>
);

export default RegisterFarmer;