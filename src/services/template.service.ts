import Template from "../models/template.model";

import { getCurrentISTTime } from "../utils/lib";
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from "../utils/messages";
import {
  deleteFromS3,
  getSignedUrl,
  uploadFileInS3Bucket,
} from "../utils/awsUploadService";
import { TemplateTypes } from "../utils/enum";
import { TEMPLATE_FOLDER } from "../utils/s3bucketFolder";

const { CREATE_DATA, UPDATE_DATA } = SUCCESS_MESSAGES;
const { RECORD_NOT_FOUND, IMAGE_UPLOAD_ERROR } = ERROR_MESSAGES;

class TemplateService {
  //SECTION: Method to create new template
  async createNewTemplate(
    hostelId: string,
    title: string,
    description: string,
    templateType: TemplateTypes,
    staffId: string,
    image?: string
  ): Promise<string> {
    try {
      if (image && image.includes("base64")) {
        const uploadImage = await uploadFileInS3Bucket(image, TEMPLATE_FOLDER);
        if (uploadImage !== false) {
          image = uploadImage.Key;
        } else {
          throw new Error(IMAGE_UPLOAD_ERROR);
        }
      }
      await Template.create({
        hostelId,
        title,
        description,
        image,
        templateType,
        createdBy: staffId,
        createdAt: getCurrentISTTime(),
      });

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get all templates
  async getAllTemplates(
    page: number,
    limit: number,
    search?: string,
    hostelId?: string,
    templateType?: TemplateTypes
  ): Promise<{ templates: any[]; count: number }> {
    try {
      // Calculate the number of documents to skip
      const skip = (page - 1) * limit;

      // Build the query for searching roles
      const query: any = {};
      if (search) {
        query.title = { $regex: new RegExp(`\\b${search}\\b`, "i") };
      }

      if (hostelId) {
        query.hostelId = hostelId;
      }

      if (templateType) {
        query.templateType = templateType;
      }

      // Run both queries in parallel
      const [templates, count] = await Promise.all([
        Template.find(query)
          .populate([
            { path: "createdBy", select: "name" },
            { path: "hostelId", select: "name" },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Template.countDocuments(query),
      ]);

      const response = await Promise.all(
        templates.map(async (ele: any) => ({
          _id: ele._id,
          hostelName: ele?.hostelId?.name ?? null,
          title: ele?.title ?? null,
          description: ele?.description ?? null,
          image: ele?.image ? await getSignedUrl(ele?.image) : null,
          templateType: ele?.templateType ?? null,
          status: ele?.status ?? null,
          createdBy: (ele?.createdBy as any)?.name ?? null,
          createdAt: ele?.createdAt ?? null,
        }))
      );

      return { templates: response, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get template by id
  async getTemplateById(id: string): Promise<{ template: any }> {
    try {
      // Run both queries in parallel
      const template: any = await Template.findById(id);
      if (!template) {
        throw new Error(RECORD_NOT_FOUND("Template"));
      }

      if (template?.image) {
        template.image = await getSignedUrl(template?.image);
      }

      return { template };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to update a new template
  async updateTemplate(
    id: string,
    hostelId: string,
    title: string,
    description: string,
    image: string,
    templateType: TemplateTypes,
    updatedById: string,
    status?: boolean
  ): Promise<string> {
    try {
      const template = await Template.findById(id);

      let payload: any = {
        hostelId,
        title,
        description,
        templateType,
        status: status ?? true,
        updatedBy: updatedById,
        updatedAt: getCurrentISTTime(),
      };

      //NOTE: If admin want to remove the image.
      if (image === null) {
        const existingImageKey: any = template?.image;
        if (existingImageKey) {
          await deleteFromS3(
            process.env.S3_BUCKET_NAME ?? "yoco-staging",
            existingImageKey
          );
        }
        payload.image = null;
      }

      // Handle image if signed url
      if (image && image.includes("amazonaws.com")) {
        payload.image = template?.image;
      } else {
        if (image?.includes("base64") && image && image !== null) {
          const existingImageKey: any = template?.image;
          if (existingImageKey) {
            await deleteFromS3(
              process.env.S3_BUCKET_NAME ?? "yoco-staging",
              existingImageKey
            );
          }
          const uploadImage = await uploadFileInS3Bucket(
            image,
            TEMPLATE_FOLDER
          );
          if (uploadImage !== false) {
            payload.image = uploadImage.Key;
          } else {
            throw new Error(IMAGE_UPLOAD_ERROR);
          }
        }
      }
      await Template.findByIdAndUpdate(id, { $set: { ...payload } });
      return UPDATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to check template exists or not (NEW SYSTEM - Uses GlobalTemplate/HostelTemplate)
  async checkTemplateExist(
    hostelId: string,
    templateType: TemplateTypes
  ): Promise<{ template: any }> {
    try {
      const notificationTemplateAdapter =
        require("./notificationTemplateAdapter.service").default;

      const notificationData =
        await notificationTemplateAdapter.getNotificationTemplate(
          templateType,
          hostelId
        );

      if (!notificationData) {
        return { template: null };
      }

      // Format to match expected structure
      const template = {
        title: notificationData.heading,
        description: notificationData.body,
        image: notificationData.image,
        _templateType: templateType, // Keep for reference
      };

      return { template };
    } catch (error: any) {
      // If new system fails, try old Template model as fallback
      try {
        const exists: any = await Template.findOne({
          hostelId,
          templateType,
        }).select("title description image");

        if (exists?.image) {
          exists.image = await getSignedUrl(exists.image);
        }

        return { template: exists };
      } catch (fallbackError: any) {
        throw new Error(error.message);
      }
    }
  }
}

export default new TemplateService();
