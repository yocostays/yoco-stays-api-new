import { v4 as uuidv4 } from "uuid";
import s3 from "./~awsConfig";

const MIN_MULTIPART_SIZE = 5 * 1024 * 1024;

//ANCHOR - get Base64 Content Type
const getBase64ContentType = (base64Data: string): string | null => {
  let contentType: string | null = null;

  if (base64Data) {
    const commaIndex = base64Data.indexOf(",");
    if (commaIndex !== -1) {
      const dataHeader = base64Data.substring(0, commaIndex);
      if (dataHeader.startsWith("data:")) {
        contentType = dataHeader.split(":")[1].split(";")[0];
      } else {
        window.console.log("error");
      }
    }
  }

  return contentType;
};

//ANCHOR : get extension type
const getBase64ExtensionType = (base64Data: string): string => {
  const regex = /^data:([a-zA-Z]+)\/([a-zA-Z0-9+.-]+);base64,/i;
  const result = regex.exec(base64Data);
  if (!result) {
    throw new Error("Invalid base64 data");
  }

  const extension = result[2].toLowerCase();
  return extension;
};

//ANCHOR - function for upload file in aws s3 bucket
export const uploadFileInS3Bucket = async (
  file: string,
  s3directorypath: string
): Promise<AWS.S3.ManagedUpload.SendData | false> => {
  try {
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!bucketName) {
      throw new Error("S3_BUCKET_NAME is not defined in environment variables");
    }

    const contentType =
      getBase64ContentType(file) ?? "application/octet-stream";
    const extension = getBase64ExtensionType(file);
    const fileS3 = file.split("base64,")[1];

    const s3path = new Date().getTime() + "-" + uuidv4() + `.${extension}`;
    const key = `${s3directorypath}/${s3path}`;

    const fileBuffer = Buffer.from(fileS3, "base64");

    // Check if the file is large enough to require multipart upload
    if (fileBuffer.length >= MIN_MULTIPART_SIZE) {
      // Multipart upload
      return await multipartUpload(bucketName, key, fileBuffer, contentType);
    } else {
      // Standard upload
      const params: AWS.S3.PutObjectRequest = {
        Bucket: bucketName,
        Key: key,
        Body: fileBuffer,
        ContentEncoding: "base64",
        ContentType: contentType,
      };

      const s3response: AWS.S3.ManagedUpload.SendData = await s3
        .upload(params)
        .promise();

      return s3response;
    }
  } catch (error) {
    console.error("Error during S3 upload:", error);
    return false;
  }
};

export const uploadFileToCloudStorage = async (
  file: Express.Multer.File, // File object from form data
  s3directorypath: string
): Promise<AWS.S3.ManagedUpload.SendData | false> => {
  try {
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!bucketName) {
      throw new Error("S3_BUCKET_NAME is not defined in environment variables");
    }

    const extension = file.originalname.split(".").pop()?.toLowerCase(); // Extract file extension
    let contentType = file.mimetype || "application/octet-stream"; // Default content type

    // Explicitly set content type for known formats
    if (extension === "mp3") {
      contentType = "audio/mpeg";
    } else if (extension === "wav") {
      contentType = "audio/wav";
    }

    const s3path = `${new Date().getTime()}-${uuidv4()}.${extension}`;
    const key = `${s3directorypath}/${s3path}`;

    const fileBuffer = file.buffer; // The file buffer received from form data

    // Check if the file is large enough to require multipart upload
    if (fileBuffer.length >= MIN_MULTIPART_SIZE) {
      return await multipartUpload(bucketName, key, fileBuffer, contentType);
    } else {
      const params: AWS.S3.PutObjectRequest = {
        Bucket: bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType, // Ensure correct MIME type is set
      };

      const s3response: AWS.S3.ManagedUpload.SendData = await s3
        .upload(params)
        .promise();

      return s3response;
    }
  } catch (error) {
    console.error("Error during S3 upload:", error);
    return false;
  }
};

//ANCHOR: Function to handle multipart upload for large files
export const multipartUpload = async (
  bucketName: string,
  key: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<AWS.S3.ManagedUpload.SendData | false> => {
  try {
    const uploadParams: AWS.S3.CreateMultipartUploadRequest = {
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      ACL: "public-read",
    };

    const multipartUploadResponse = await s3
      .createMultipartUpload(uploadParams)
      .promise();
    const uploadId = multipartUploadResponse.UploadId;

    // Break the file into parts for upload
    const partSize = 5 * 1024 * 1024; // 5MB per part, adjust as needed
    const parts = Math.ceil(fileBuffer.length / partSize);
    const partPromises = [];

    for (let partNumber = 1; partNumber <= parts; partNumber++) {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(partNumber * partSize, fileBuffer.length);

      const partBuffer = fileBuffer.slice(start, end);

      const partParams: AWS.S3.UploadPartRequest = {
        Bucket: bucketName,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId!,
        Body: partBuffer,
        ContentLength: partBuffer.length,
      };

      partPromises.push(s3.uploadPart(partParams).promise());
    }

    const partResults = await Promise.all(partPromises);

    // Complete the upload
    const completeParams: AWS.S3.CompleteMultipartUploadRequest = {
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId!,
      MultipartUpload: {
        Parts: partResults.map((result, index) => ({
          ETag: result.ETag,
          PartNumber: index + 1,
        })),
      },
    };

    const completeResponse = await s3
      .completeMultipartUpload(completeParams)
      .promise();

    // We return an object similar to SendData
    const sendData: AWS.S3.ManagedUpload.SendData = {
      Location: completeResponse.Location!, // Ensure this is always present
      Bucket: completeResponse.Bucket!,
      Key: completeResponse.Key!,
      ETag: completeResponse.ETag!,
      // Add any additional fields you need here (if applicable)
    };

    return sendData;
  } catch (error) {
    console.error("Error during multipart upload:", error);
    return false;
  }
};

//ANCHOR: Utility function to delete a file from S3
export const deleteFromS3 = async (
  bucketName: string,
  fileKey: string
): Promise<AWS.S3.DeleteObjectOutput> => {
  const params: AWS.S3.DeleteObjectRequest = {
    Bucket: bucketName,
    Key: fileKey,
  };

  return s3.deleteObject(params).promise();
};

//ANCHOR - function for get s3 url
export const getSignedUrl = async (key: string): Promise<string | null> => {
  try {
    const s3info = s3.getSignedUrlPromise("getObject", {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Expires: 60,
    });

    // Create a sanitized display URL (without sensitive query parameters)
    const displayUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    return displayUrl;
  } catch (error) {
    return null;
  }
};

//NOTE: Convert the array of objects to a CSV string using ObjectsToCsv
const arrayToCSV = (objArray: string) => {
  const array = typeof objArray !== "object" ? JSON.parse(objArray) : objArray;
  const str =
    `${Object.keys(array[0])
      .map((value) => `"${value}"`)
      .join(",")}` + "\r\n";

  return array.reduce(
    (str: string, next: { [s: string]: unknown } | ArrayLike<unknown>) => {
      str +=
        `${Object.values(next)
          .map((value) => `"${value}"`)
          .join(",")}` + "\r\n";
      return str;
    },
    str
  );
};

//ANCHOR - function for push To S3 Bucket
export const pushToS3Bucket = async (
  array: any[],
  bucketName: string,
  folderName: string
): Promise<string> => {
  //NOTE: Convert the JSON array to an array of JavaScript objects
  const objectsArray = JSON.parse(JSON.stringify(array));

  const csv = await arrayToCSV(objectsArray);

  // const csv = new ObjectsToCsv(objectsArray);
  const csvString = await csv?.toString();

  //NOTE: Encode the CSV string as UTF-8
  const csvBuffer = Buffer.from(csvString, "utf-8");

  let s3path: string = new Date().getTime() + "-" + uuidv4() + ".csv";

  const params: AWS.S3.PutObjectRequest = {
    Bucket: bucketName,
    Key: `${folderName}/${s3path}`,
    Body: csvBuffer,
    ContentType: "text/csv; charset=utf-8",
  };

  const s3response: AWS.S3.ManagedUpload.SendData = await s3
    .upload(params)
    .promise();
  return s3response.Key;
};
