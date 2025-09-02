import mongoose from "mongoose";
import ComplainSubCategory from "../models/complaint-subCategory.model";
import { getCurrentISTTime } from "../utils/lib";
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from "../utils/messages";
import { COMPLAIN_CATEGORY_FOLDER } from "../utils/s3bucketFolder";

const { CREATE_DATA } = SUCCESS_MESSAGES;

class ComplainSubCategoryService {
  //SECTION: Method to create a new sub category
  async createNewComplainSubCategory(
    categoryId: string,
    values: { name: string; image?: string }[]
  ): Promise<string> {
    try {
      // Prepare an array to hold the new subcategories
      const newSubCategories: any[] = [];

      // Iterate through the values array to create subcategories
      for (const subCategory of values) {
        const { name } = subCategory;

        // Check if a subcategory with the same name already exists under the same category
        const existingSubCategory = await ComplainSubCategory.findOne({
          name,
          categoryId,
        });
        if (existingSubCategory) {
          throw new Error(
            `Subcategory with the name '${name}' already exists under this category.`
          );
        }

        // Prepare the new subcategory data
        const newSubCategory = {
          name,
          categoryId: new mongoose.Types.ObjectId(categoryId), // Associate with categoryId
          createdBy: null,
          createdAt: getCurrentISTTime(),
          updatedAt: getCurrentISTTime(),
        };

        // Push the new subcategory into the array for bulk insertion
        newSubCategories.push(newSubCategory);
      }

      // Insert all the new subcategories in bulk
      await ComplainSubCategory.insertMany(newSubCategories);
      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(`Failed to create subcategories: ${error.message}`);
    }
  }

  //SECTION: Method to get all Complain sub Category
  async getAllComplainSubCategory(
    categoryId: string
  ): Promise<{ subCategories: any[] }> {
    try {
      const subCategories = await ComplainSubCategory.find({
        categoryId: new mongoose.Types.ObjectId(categoryId),
      });

      // Prepare the response data
      const response = await Promise.all(
        subCategories.map(async (ele) => ({
          _id: ele._id,
          categoryId: ele?.categoryId ?? null,
          name: ele?.name ?? null,
        }))
      );

      // Separate "Other" and non-"Other" items, and then combine them
      const otherSubCategories = response.filter(
        (ele) => ele.name.toLowerCase() === "other"
      );

      const nonOtherSubCategories = response.filter(
        (ele) => ele.name.toLowerCase() !== "other"
      );

      return {
        subCategories: [...nonOtherSubCategories, ...otherSubCategories],
      };
    } catch (error: any) {
      throw new Error(`Failed to retrieve sub categories: ${error.message}`);
    }
  }
}

export default new ComplainSubCategoryService();
