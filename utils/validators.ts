export const isValidPhone = (phone: string) => {
  return /^09\d{9}$/.test(phone);
};

export const formatPhilippinePhoneNumber = (phone: string) => {
  const trimmedPhone = phone.trim();
  const digits = trimmedPhone.replace(/\D/g, "");
  const internationalDigits = digits.startsWith("09")
    ? `63${digits.slice(1)}`
    : digits;

  if (!/^639\d{9}$/.test(internationalDigits)) {
    return phone;
  }

  return `+63 ${internationalDigits.slice(2, 5)} ${internationalDigits.slice(5, 8)} ${internationalDigits.slice(8)}`;
};

export const isGmail = (email: string) => {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email);
};

// Validates the email format using a regular expression
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_REGEX = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]*$/;
const FARM_NAME_REGEX = /^[A-Za-z0-9À-ÿ][A-Za-z0-9À-ÿ .,'&-]*$/;

// User types only the 10 digits after +63 (e.g. 9123456789)
export const sanitizePhoneInput = (value: string) =>
  value.replace(/\D/g, "").replace(/^0+/, "").replace(/^63/, "").slice(0, 10);

export const isValidPhPhone = (digits: string) => /^9\d{9}$/.test(digits);
export const toE164Phone = (digits: string) => `+63${digits}`;

export const validateDetails = ({
  fullName,
  email,
  phone,
}: {
  fullName: string;
  email: string;
  phone: string;
}): string | null => {
  const name = fullName.trim();
  if (!name) return "Enter your full name.";
  if (name.length < 2 || name.length > 60 || !NAME_REGEX.test(name))
    return "Full name can only contain letters, spaces, periods, apostrophes, and hyphens.";
  if (!name.includes(" ")) return "Enter both your first and last name.";

  const mail = email.trim();
  if (!mail) return "Enter your email address.";
  if (!EMAIL_REGEX.test(mail))
    return "Invalid email format. Example: juan@gmail.com";
  if (!isGmail(mail)) return "Only Gmail addresses (@gmail.com) are accepted.";

  if (!phone) return "Enter your mobile number.";
  if (!isValidPhPhone(phone))
    return "Enter a valid PH mobile number: 10 digits starting with 9.";
  return null;
};

export const validatePasswords = ({
  password,
  confirmPassword,
}: {
  password: string;
  confirmPassword: string;
}): string | null => {
  if (!password) return "Enter a password.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (/\s/.test(password)) return "Password cannot contain spaces.";
  if (!/^[\x21-\x7E]+$/.test(password))
    return "Password cannot contain emojis or special symbols outside the standard keyboard characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Password must include at least one letter and one number.";
  if (!confirmPassword) return "Confirm your password.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
};

export const validateFarm = ({
  farmName,
  selectedCity,
  selectedBarangay,
}: {
  farmName: string;
  selectedCity: any;
  selectedBarangay: any;
}): string | null => {
  const name = farmName.trim();
  if (!name) return "Enter your farm name.";
  if (name.length < 2 || name.length > 60 || !FARM_NAME_REGEX.test(name))
    return "Farm name has invalid characters or is too short.";
  if (!selectedCity) return "Select your city / municipality.";
  if (!selectedBarangay) return "Select your barangay.";
  return null;
};

export const getRegisterErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Try signing in instead.";
    case "auth/invalid-email":
      return "Invalid email format.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 8 characters with letters and numbers.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "We couldn't complete your registration. Please try again.";
  }
};