// app/buyer/(tabs)/qr.tsx

import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";

import {
  router,
} from "expo-router";

import {
  useRef,
} from "react";

import {
  Linking,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppAlert } from "@/context/FarmerAlertContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function QRScanner() {
  const Alert = useAppAlert();
  const insets = useSafeAreaInsets();

  // ================= CAMERA PERMISSION =================
  const [
    permission,
    requestPermission,
  ] = useCameraPermissions();

  // ================= ANTI MULTIPLE SCAN =================
  const scanningRef =
    useRef(false);

  const openCameraSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error("OPEN CAMERA SETTINGS ERROR:", error);
      Alert.alert(
        "Unable to Open Settings",
        "Please open your device settings and allow FarmGate to use the camera."
      );
    }
  };

  const requestCameraAccess = async () => {
    try {
      const result = await requestPermission();
      if (result.granted) return;

      Alert.alert(
        "Camera Access Needed",
        "Camera access is required to scan a farm QR code and open its shop.",
        [
          { text: "Not now", style: "cancel" },
          result.canAskAgain
            ? { text: "Try again", onPress: requestCameraAccess }
            : { text: "Open Settings", onPress: openCameraSettings },
        ]
      );
    } catch (error) {
      console.error("REQUEST CAMERA PERMISSION ERROR:", error);
      Alert.alert(
        "Camera Permission Error",
        "FarmGate couldn't request camera access. Please try again."
      );
    }
  };

  // ================= LOADING =================
  if (!permission) {

    return (
      <View className="flex-1 bg-white" />
    );
  }

  // ================= PERMISSION UI =================
  if (!permission.granted) {

    return (
      <View className="flex-1" style={{ backgroundColor: "#fafafa" }}>
        <View
          className="rounded-b-2xl px-5 pb-5"
          style={{ backgroundColor: "#14532d", paddingTop: 56 }}
        >
          <Text className="text-white text-lg font-bold">Scan Farm QR</Text>
        </View>

        <View className="flex-1 justify-center px-6">
          <View className="items-center rounded-[10px] bg-white px-6 py-8">
            <View
              className="mb-5 h-20 w-20 items-center justify-center rounded-full"
              style={{ backgroundColor: "#f0fdf4" }}
            >
              <MaterialCommunityIcons
                name="camera-outline"
                size={38}
                color="#14532d"
              />
            </View>
            <Text className="text-center text-xl font-bold text-gray-900">
              Camera access needed
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-gray-600">
              Allow camera access to scan a farm QR code and open its shop.
            </Text>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={
                permission.canAskAgain
                  ? requestCameraAccess
                  : openCameraSettings
              }
              className="mt-6 w-full items-center rounded-[10px] px-5 py-3.5"
              style={{ backgroundColor: "#14532d" }}
            >
              <Text className="font-semibold text-white">
                {permission.canAskAgain ? "Allow Camera" : "Open Settings"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ================= HANDLE QR SCAN =================
  const handleScan = ({
    data,
  }: any) => {

    // BLOCK MULTIPLE FAST SCANS
    if (scanningRef.current)
      return;

    scanningRef.current = true;

    console.log(
      "SCANNED:",
      data
    );

    // ================= VALID FARM QR =================
    // EXAMPLE:
    // client://farm/abc123

    if (
      data.startsWith(
        "client://farm/"
      )
    ) {

      const farmerId =
        data.replace(
          "client://farm/",
          ""
        );

      console.log(
        "FARMER ID:",
        farmerId
      );

      // REDIRECT
      router.push({
        pathname:
          "/buyer/farm/[farmerId]",

        params: {
          farmerId,
        },
      });

      // RESET SCANNER
      setTimeout(() => {

        scanningRef.current =
          false;

      }, 2000);

      return;
    }

    // ================= INVALID QR =================
    Alert.alert(
      "Invalid QR Code",
      "This QR code is not supported.",
      [
        {
          text: "OK",

          onPress: () => {

            scanningRef.current =
              false;
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleScan}
      />

      <View
        pointerEvents="box-none"
        className="absolute inset-0"
      >
        <View
          className="absolute left-0 right-0 px-6"
          style={{ top: insets.top + 16 }}
        >
          <View className="flex-row items-center">
            <View
              className="mr-3 h-11 w-11 items-center justify-center rounded-[10px]"
              style={{ backgroundColor: "rgba(255,255,255,0.16)" }}
            >
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={23}
                color="white"
              />
            </View>
            <View>
              <Text className="text-xs font-semibold uppercase tracking-widest text-white/75">
                FarmGate
              </Text>
              <Text className="mt-0.5 text-xl font-bold text-white">
                Scan a farm QR
              </Text>
            </View>
          </View>
          <Text className="mt-4 text-sm leading-5 text-white/85">
            Find a farm and browse its fresh products.
          </Text>
        </View>

        <View
          pointerEvents="none"
          className="absolute left-0 right-0 items-center"
          style={{ top: "36%" }}
        >
          <View
            className="h-[270px] w-[270px] items-center justify-center rounded-[24px]"
            style={{
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.45)",
              backgroundColor: "rgba(0,0,0,0.08)",
            }}
          >
            <View
              className="absolute left-0 top-0 h-9 w-9 rounded-tl-[24px]"
              style={{
                borderLeftWidth: 4,
                borderTopWidth: 4,
                borderColor: "#86efac",
              }}
            />
            <View
              className="absolute right-0 top-0 h-9 w-9 rounded-tr-[24px]"
              style={{
                borderRightWidth: 4,
                borderTopWidth: 4,
                borderColor: "#86efac",
              }}
            />
            <View
              className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-[24px]"
              style={{
                borderBottomWidth: 4,
                borderLeftWidth: 4,
                borderColor: "#86efac",
              }}
            />
            <View
              className="absolute bottom-0 right-0 h-9 w-9 rounded-br-[24px]"
              style={{
                borderBottomWidth: 4,
                borderRightWidth: 4,
                borderColor: "#86efac",
              }}
            />
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={32}
              color="rgba(255,255,255,0.78)"
            />
          </View>
          <Text className="mt-5 text-sm font-semibold text-white">
            Align the QR code inside the frame
          </Text>
        </View>

        <View
          pointerEvents="none"
          className="absolute left-5 right-5 flex-row items-center rounded-[10px] px-4 py-3.5"
          style={{
            bottom: 108 + insets.bottom,
            backgroundColor: "rgba(17,24,39,0.78)",
          }}
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={20}
            color="#bbf7d0"
          />
          <Text className="ml-3 flex-1 text-xs leading-5 text-white/90">
            Hold your phone steady and make sure the code is well lit.
          </Text>
        </View>
      </View>
    </View>
  );
}