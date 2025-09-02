import { Request, Response, NextFunction } from "express";
import { HttpResponse } from "../utils/httpResponse";
import Token from "../models/token.model";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AccountType } from "../utils/enum";
import { ERROR_MESSAGES } from "../utils/messages";

const { UNAUTHORIZED_ACCESS } = ERROR_MESSAGES;

const algorithm = "aes-256-cbc";

const validateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization;

  if (!token) {
    const response: HttpResponse = {
      statusCode: 401,
      message: UNAUTHORIZED_ACCESS,
    };
    return res.status(401).json(response);
  }

  try {
    // Split the token to get IV and encrypted token
    const [ivHex, encryptedToken] = token.split(":");
    const iv = Buffer.from(ivHex, "hex"); // Convert IV from hex to Buffer

    // Create a buffer for the encryption key
    const encryptionKeyBuffer = Buffer.from(
      process.env.ENCRYPTION_KEY as string,
      "hex"
    );

    // Decrypt the token
    const decipher = crypto.createDecipheriv(
      algorithm,
      encryptionKeyBuffer,
      iv
    );
    let decrypted = decipher.update(encryptedToken, "hex", "utf8");
    decrypted += decipher.final("utf8");

    // Verify the decrypted token
    const decoded = jwt.verify(decrypted, process.env.SECRET_KEY as string) as {
      _id: string;
    };

    // Fetch the token from the database
    const tokenFromDb: any = await Token.findOne({
      userId: decoded._id,
    });

    if (!tokenFromDb) {
      const response: HttpResponse = {
        statusCode: 401,
        message: UNAUTHORIZED_ACCESS,
      };
      return res.status(401).json(response);
    }

    // Handle case where the token is not found
    if (tokenFromDb.accountType !== AccountType.STAFF) {
      // Handle additional unauthorized cases
      if (
        !decoded ||
        decoded._id === undefined ||
        token !== tokenFromDb.token ||
        tokenFromDb.expiryTime <= new Date()
      ) {
        const response: HttpResponse = {
          statusCode: 401,
          message: UNAUTHORIZED_ACCESS,
        };
        return res.status(401).json(response);
      }
    }

    req.body._valid = { ...decoded, userType: tokenFromDb.accountType };
    next();
  } catch (err) {
    const response: HttpResponse = {
      statusCode: 401,
      message: UNAUTHORIZED_ACCESS,
    };
    return res.status(401).json(response);
  }
};

export default validateToken;
