import bcrypt from "bcryptjs";
/**
 * Hashes a password using bcryptjs.
 * @param password - The plain text password to hash.
 * @param saltRounds - The number of salt rounds for bcrypt (default is 16).
 * @returns The hashed password.
 */
export const hashPassword = async (
    password: string,
    saltRounds: number = 16
  ): Promise<string> => {
    try {
      const salt = await bcrypt.genSalt(saltRounds);
      const hashedPassword = await bcrypt.hash(password, salt);
      return hashedPassword;
    } catch (error) {
      throw new Error("Error while hashing the password");
    }
  };
  
  /**
   * Compares a plain text password with a hashed password.
   * @param plainPassword - The plain text password to compare.
   * @param hashedPassword - The hashed password to compare against.
   * @returns A boolean indicating if the passwords match.
   */
  export const comparePassword = async (
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> => {
    return bcrypt.compare(plainPassword, hashedPassword);
  };
  