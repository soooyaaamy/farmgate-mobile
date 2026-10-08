import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOut } from "firebase/auth";
import { loginUser } from "../../src/services/authService";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../FirebaseConfig";
import { useToast } from "../../context/ToastContext";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getAuthErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/invalid-email":
      return "Invalid email format.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    default:
      return "Something went wrong. Please try again.";
  }
};

const Login = () => {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {

    const trimmedEmail = email.trim();

    if (!trimmedEmail && !password) {
      showToast("Please enter your email and password.");
      return;
    }
    if (!trimmedEmail) {
      showToast("Please enter your email.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      showToast("Invalid email format. Example: name@example.com");
      return;
    }
    if (!password) {
      showToast("Please enter your password.");
      return;
    }

    try {
      setLoading(true);

      // AUTH LOGIN
      const user = await loginUser(
        trimmedEmail,
        password
      );

      // FIRESTORE DATA
      const userDoc = await getDoc(
        doc(db, "users", user.uid)
      );

      if (!userDoc.exists()) {
        if (!user.emailVerified) {
          await signOut(auth);
          showToast("Please verify your email before completing registration.");
          return;
        }
        showToast("User doesn't exist.");
        return;
      }

      // APPROVAL CHECK
      // Bawal mag-login kapag hindi approved. Naka-signOut agad
      // para hindi maiwan ang Firebase session ng pending/rejected.
      const userData = userDoc.data();
      const status = userData.status ?? "approved";

      if (status === "pending") {
        await signOut(auth);
        Alert.alert(
          "Pending approval",
          "Your account is waiting for admin approval. You cannot log in yet."
        );
        return;
      }
      if (status === "rejected") {
        await signOut(auth);
        Alert.alert(
          "Account rejected",
          "Your registration was rejected. Please contact support."
        );
        return;
      }
      if (status === "banned") {
        await signOut(auth);
        Alert.alert(
          "Account is banned",
          "Your account has been banned. Please contact support."
        );
        return;
      }
      if (status !== "approved") {
        await signOut(auth);
        Alert.alert(
          "Not approved",
          "Your account is not approved yet."
        );
        return;
      }

      // SAVE LOCAL
      await AsyncStorage.setItem(
        "user",
        JSON.stringify(userData)
      );



      // ROLE ROUTE
      if (userData.role === "farmer") {
        router.replace(
          "/farmer/(tabs)/home"
        );
      } else {
        router.replace(
          "/buyer/(tabs)/home"
        );
      }
    } catch (error: any) {
      showToast(getAuthErrorMessage(error?.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: "#14532d" }}>
      <StatusBar barStyle="light-content" backgroundColor="#14532d" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center justify-center bg-[#14532d] px-6 py-32">
          <Image
            className="w-20 h-20 mb-3"
            resizeMode="contain"
            source={require("../../assets/Farmgate-logos/farmgate-logo.png")}
          />
          <Text className="text-white text-2xl font-bold tracking-wide">
            FARMGATE DIRECT
          </Text>
          <Text className="text-green-100 text-sm mt-2 text-center">
            From the hands of farmers to the homes of buyers.
          </Text>
        </View>

        <View
          className="flex-1 bg-white rounded-t-[30px] px-5 -mt-70 pt-5"
          style={{ flexGrow: 1 }}
        >
          <View className="pt-5">
            <Text className="text-gray-900 text-2xl font-bold">
              Welcome back
            </Text>
            <Text className="text-gray-500 text-sm mt-2">
              Sign in to continue to your account.
            </Text>
          </View>

          <View className="pt-5">
            <Text className="text-gray-700 text-sm font-semibold mb-2">
              Email
            </Text>
            <View className="flex-row items-center bg-white border border-gray-200 rounded-[5px] px-3 mb-5">
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color="#14532d"
              />
              <TextInput
                className="flex-1 py-3 px-3 text-gray-800"
                placeholder="Enter your email"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <Text className="text-gray-700 text-sm font-semibold mb-2">
              Password
            </Text>
            <View className="flex-row items-center bg-white border border-gray-200 rounded-[5px] px-3 mb-7">
              <MaterialCommunityIcons
                name="lock-outline"
                size={20}
                color="#14532d"
              />
              <TextInput
                className="flex-1 py-3 px-3 text-gray-800"
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity
              className="items-center justify-center rounded-[5px] py-3.5"
              style={{ backgroundColor: "#14532d" }}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Sign in</Text>
              )}
            </TouchableOpacity>

            <Text className="text-center text-gray-500 mt-6">
              Don’t have an account yet?{" "}
              <Text
                className="font-semibold"
                style={{ color: "#14532d" }}
                onPress={() => router.push("./register")}
              >
                Register
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default Login;