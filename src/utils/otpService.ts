import { randomBytes } from "crypto";
import { VALIDATION_MESSAGES } from "../utils/messages";

const { EXPIRY_TIME_ERROR } = VALIDATION_MESSAGES;

//ANCHOR: Function to generate a 6-digit OTP
// export const generateSecureOtp = (): number => {
//   let otp;
//   do {
//     const buffer = randomBytes(2); // Generate 2 random bytes
//     otp = buffer.readUInt16BE(0) % 10000; // Convert to a number and mod by 10000
//   } while (otp < 1000); // Repeat if the OTP is less than 1000 (to avoid leading zero)

//   return otp;
// };

export const generateSecureOtp = (): number => {
  let otp;
  do {
    const buffer = randomBytes(3);
    otp = buffer.readUIntBE(0, 3) % 1000000; 
  } while (otp < 100000); 

  return otp;
};



//ANCHOR: Function to get the expiry date based on the interval and duration type
export const getExpiryDate = (
  interval: number,
  duration: "D" | "H" | "M" | "S"
): Date => {
  const currentDate = new Date(); // The current date and time

  // Define the date manipulation functions for each duration type
  const dateManipulation = {
    D: (value: number) => currentDate.setDate(currentDate.getDate() + value), // Days
    H: (value: number) => currentDate.setHours(currentDate.getHours() + value), // Hours
    M: (value: number) =>
      currentDate.setMinutes(currentDate.getMinutes() + value), // Minutes
    S: (value: number) =>
      currentDate.setSeconds(currentDate.getSeconds() + value), // Seconds
  };

  // Apply the correct manipulation function
  if (dateManipulation[duration]) {
    dateManipulation[duration](interval);
  } else {
    throw new Error(EXPIRY_TIME_ERROR);
  }

  return currentDate;
};
