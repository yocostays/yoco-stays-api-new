import ComplainCategory from "../models/complaint-category.model";
import Role from "../models/role.model";
import { getSignedUrl, uploadFileInS3Bucket } from "../utils/awsUploadService";
import { getCurrentISTTime } from "../utils/lib";
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from "../utils/messages";
import { COMPLAIN_CATEGORY_FOLDER } from "../utils/s3bucketFolder";

const { IMAGE_UPLOAD_ERROR, RECORD_NOT_FOUND } = ERROR_MESSAGES;
const { CREATE_DATA } = SUCCESS_MESSAGES;

class ComplainCategoryService {
  //SECTION: Method to create a new category
  async createNewComplainCategory(
    categories: { name: string; image: string }[],
    staffId: string
  ): Promise<string> {
    try {
      // Prepare an array to hold the new categories
      const newCategories: any[] = [];

      // Iterate through the categories array
      for (const category of categories) {
        const { name, image } = category;

        // Check if a category with the same name already exists
        const existingCategory = await ComplainCategory.findOne({ name });
        if (existingCategory) {
          throw new Error(`Category with the name '${name}' already exists.`);
        }

        let imageKey: string | undefined;

        // Check if the image is in base64 format and upload it to S3
        if (image && image.includes("base64")) {
          const uploadImage = await uploadFileInS3Bucket(
            image,
            COMPLAIN_CATEGORY_FOLDER
          );
          if (uploadImage !== false) {
            imageKey = uploadImage.Key;
          } else {
            throw new Error(IMAGE_UPLOAD_ERROR);
          }
        }

        // Prepare the new category data
        const newCategory = {
          name,
          image: imageKey, // Store the S3 key if the image was uploaded
          createdBy: staffId,
          createdAt: getCurrentISTTime(),
          updatedAt: getCurrentISTTime(),
        };

        // Push the new category into the array for bulk insertion
        newCategories.push(newCategory);
      }

      // Insert all the new categories in bulk
      await ComplainCategory.insertMany(newCategories);
      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(`Failed to create categories: ${error.message}`);
    }
  }

  //SECTION: Method to get all Complain Category
  async getAllComplainCategory(
    roleId?: string
  ): Promise<{ categories: any[] }> {
    try {
      const matchCondition: any = {};

      // If type is provided, filter categories by categoryType
      if (roleId) {
        const role = await Role.findById(roleId);
        if (!role) {
          throw new Error(RECORD_NOT_FOUND("Role"));
        }
        matchCondition.categoryType = role?.categoryType;
      }

      const categories = await ComplainCategory.find(matchCondition);

      // Prepare the response data
      const response = await Promise.all(
        categories.map(async (category) => ({
          _id: category._id,
          name: category?.name ?? null,
          image: category?.image ? await getSignedUrl(category.image) : null,
        }))
      );
      return { categories: response };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
}

export default new ComplainCategoryService();
