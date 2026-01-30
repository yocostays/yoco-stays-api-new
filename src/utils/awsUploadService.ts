import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

// Minimum size for multipart (not used locally)
const MIN_MULTIPART_SIZE = 5 * 1024 * 1024;

// Extract content type from base64 string
const getBase64ContentType = (base64Data: string): string | null => {
  if (base64Data) {
    const commaIndex = base64Data.indexOf(",");
    if (commaIndex !== -1) {
      const header = base64Data.substring(0, commaIndex);
      if (header.startsWith("data:")) {
        return header.split(":")[1].split(";")[0];
      }
    }
  }
  return null;
};

// Extract extension from base64 string
const getBase64ExtensionType = (base64Data: string): string => {
  const regex = /^data:([a-zA-Z]+)\/([a-zA-Z0-9+.-]+);base64,/i;
  const result = regex.exec(base64Data);
  if (!result) throw new Error("Invalid base64 data");
  return result[2].toLowerCase();
};

// Save buffer to local filesystem
const saveToLocal = (buffer: Buffer, directory: string, filename: string): string => {
  const baseUploadsPath = path.resolve(process.cwd(), "./uploads"); // OUTSIDE your project root
  const fullDir = path.join(baseUploadsPath, directory);
  const filePath = path.join(fullDir, filename);

  try {
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (err) {
    throw err;
  }
};


// Upload file from base64 string
export const uploadFileInS3Bucket = async (
  file: string,
  s3directorypath: string
): Promise<any | false> => {
  try {
    const contentType = getBase64ContentType(file) ?? "application/octet-stream";
    const extension = getBase64ExtensionType(file);
    const fileBase64 = file.split("base64,")[1];
    const fileBuffer = Buffer.from(fileBase64, "base64");

    const filename = `${Date.now()}-${uuidv4()}.${extension}`;
    const localPath = saveToLocal(fileBuffer, s3directorypath, filename);

    return {
      Location: localPath,
      Bucket: "local-dev-bucket",
      Key: `${s3directorypath}/${filename}`,
      ETag: "",
      ContentType: contentType,
    };
  } catch (error) {
    return false;
  }
};

// Upload file from Express buffer
export const uploadFileToCloudStorage = async (
  file: Express.Multer.File,
  s3directorypath: string
): Promise<any | false> => {
  try {
    const extension = file.originalname.split(".").pop()?.toLowerCase() || "bin";
    let contentType = file.mimetype || "application/octet-stream";

    if (extension === "mp3") contentType = "audio/mpeg";
    else if (extension === "wav") contentType = "audio/wav";

    const filename = `${Date.now()}-${uuidv4()}.${extension}`;
    const localPath = saveToLocal(file.buffer, s3directorypath, filename);

    return {
      Location: localPath,
      Bucket: "local-dev-bucket",
      Key: `${s3directorypath}/${filename}`,
      ETag: "",
      ContentType: contentType,
    };
  } catch (error) {
    return false;
  }
};

// Dummy multipart function for local env
export const multipartUpload = async (): Promise<false> => {
  return false;
};

// Delete file from local
export const deleteFromS3 = async (
  bucketName: string,
  fileKey: string
): Promise<any> => {
  try {
    const baseUploadsPath = path.resolve(process.cwd(), "./uploads");
    const filePath = path.join(baseUploadsPath, fileKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (error) {
    return { success: false };
  }
};

// Generate mock signed URL
export const getSignedUrl = async (key: string): Promise<string | null> => {
  try {
    return `${process.env.ROOT_URL}/uploads/${key}`; // usable in frontend
  } catch (error) {
    return null;
  }
};

// Convert array to CSV string
const arrayToCSV = (objArray: string | any[]): string => {
  const array = typeof objArray !== "object" ? JSON.parse(objArray) : objArray;
  const header = `${Object.keys(array[0]).map((key) => `"${key}"`).join(",")}\r\n`;

  return array.reduce((str: string, row: any) => {
    str += `${Object.values(row).map((val) => `"${val}"`).join(",")}\r\n`;
    return str;
  }, header);
};

// Export array as CSV and save locally
export const pushToS3Bucket = async (
  array: any[],
  bucketName: string,
  folderName: string
): Promise<string> => {
  const csv = arrayToCSV(array);
  const csvBuffer = Buffer.from(csv, "utf-8");

  const filename = `${Date.now()}-${uuidv4()}.csv`;
  const filePath = saveToLocal(csvBuffer, folderName, filename);

  return `${folderName}/${filename}`;
};
