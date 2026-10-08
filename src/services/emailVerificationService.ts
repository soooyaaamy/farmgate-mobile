import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../FirebaseConfig";

const sendVerificationEmail = httpsCallable<
  Record<string, never>,
  { alreadyVerified: boolean }
>(getFunctions(app), "sendBrandedEmailVerification");

export const sendBrandedVerificationEmail = async () => {
  const result = await sendVerificationEmail({});
  return result.data;
};
