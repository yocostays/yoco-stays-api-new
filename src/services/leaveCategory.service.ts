import LeaveCategory from "../models/leave-category.model";
import { LeaveTypes } from "../utils/enum";
import { getCurrentISTTime } from "../utils/lib";
import { SUCCESS_MESSAGES } from "../utils/messages";

const { CREATE_DATA } = SUCCESS_MESSAGES;

class LeaveCategoryService {
  //SECTION: Method to create a new category
  async createNewLeaveCategory(
    categories: { name: string; categoryType: LeaveTypes }[],
    staffId: string
  ): Promise<string> {
    try {
      // Prepare an array to hold the new categories
      const newCategories: any[] = [];
      const existingCategories: string[] = [];

      // Iterate through the categories array
      for (const category of categories) {
        const { name, categoryType } = category;

        // Check if a category with the same name already exists
        const existingCategory = await LeaveCategory.findOne({
          name,
          categoryType,
        });

        if (existingCategory) {
          // Collect the existing category names and continue to the next iteration
          existingCategories.push(name);
          continue; // Skip this category and continue with the next one
        }

        // Prepare the new category data
        const newCategory = {
          name,
          categoryType,
          createdBy: staffId,
          createdAt: getCurrentISTTime(),
          updatedAt: getCurrentISTTime(),
        };

        // Push the new category into the array for bulk insertion
        newCategories.push(newCategory);
      }

      // Insert all the new categories in bulk if there are any
      if (newCategories.length > 0) {
        await LeaveCategory.insertMany(newCategories);
      }

      if (existingCategories.length > 0) {
        return `Categories with the following names already exist: ${existingCategories.join(
          ", "
        )}`;
      }

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(`Failed to create categories: ${error.message}`);
    }
  }

  //SECTION: Method to get all leave Category
  async getAllLeaveCategory(type: LeaveTypes): Promise<{ categories: any[] }> {
    try {
      const categories = await LeaveCategory.find({ categoryType: type });

      // Prepare the response data
      const response = await Promise.all(
        categories.map(async (category) => ({
          _id: category._id,
          name: category?.name ?? null,
          status: category?.status,
        }))
      );
      // Return both the list of categories and the total count
      return { categories: response };
    } catch (error: any) {
      throw new Error(`Failed to retrieve categories: ${error.message}`);
    }
  }
}

export default new LeaveCategoryService();
