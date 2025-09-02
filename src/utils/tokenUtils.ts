import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Load environment variables from .env file
dotenv.config();

// Encryption settings
const algorithm = 'aes-256-cbc'; // Use AES-256-CBC
const secretKey = process.env.SECRET_KEY as string;
const encryptionKey = process.env.ENCRYPTION_KEY as string;

// Ensure the encryption key is 32 bytes long
const encryptionKeyBuffer = Buffer.from(encryptionKey, 'hex');

// Ensure the encryption key is valid
if (encryptionKeyBuffer.length !== 32) {
  throw new Error('Encryption key must be 32 bytes long for AES-256.');
}

// Function to generate a JWT and encrypt it
export const generateToken = (payload: object, options?: jwt.SignOptions): string => {
  const defaultOptions: jwt.SignOptions = {
    expiresIn: '24h',
    audience: process.env.APP_NAME,
    issuer: process.env.APP_NAME,
    algorithm: 'HS256',
  };

  // Merge default options with provided options
  const finalOptions = { ...defaultOptions, ...options };

  // Generate JWT
  const token = jwt.sign(payload, secretKey, finalOptions);

  // Create a random initialization vector
  const iv = crypto.randomBytes(16); // Generate a random IV

  // Encrypt the JWT
  const cipher = crypto.createCipheriv(algorithm, encryptionKeyBuffer, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return the IV and the encrypted token
  return `${iv.toString('hex')}:${encrypted}`;
};
