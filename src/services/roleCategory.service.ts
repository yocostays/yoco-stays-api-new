import RoleCategory, { IRoleCategory } from "../models/roleCategory.model";
import { ConflictError, NotFoundError } from "../utils/errors";
import { getCurrentISTTime } from "../utils/lib";
import { ERROR_MESSAGES } from "../utils/messages";

const { RECORD_NOT_FOUND, DUPLICATE_RECORD } = ERROR_MESSAGES;

class RoleCategoryService {
  //SECTION: Method to create a new role category
  async createCategoryService(
    categoryType: string,
    staffId: string,
  ): Promise<IRoleCategory> {
    try {
      const newCategory = new RoleCategory({
        categoryType,
        createdBy: staffId,
        createdAt: getCurrentISTTime(),
      });

      return await newCategory.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictError(DUPLICATE_RECORD(categoryType));
      }
      throw new Error(error.message);
    }
  }

  //SECTION: Method to get all role categories
  async getAllCategoriesService(): Promise<{
    categories: any[];
    count: number;
  }> {
    try {
      const [categories, count] = await Promise.all([
        RoleCategory.find()
          .populate([{ path: "createdBy", select: "name" }])
          .sort({ createdAt: -1 }),
        RoleCategory.countDocuments(),
      ]);

      const response = categories.map((ele) => ({
        _id: ele._id,
        name: ele?.categoryType ?? null,
        status: ele?.status ?? true,
        createdBy: (ele?.createdBy as any)?.name ?? null,
        createdAt: ele?.createdAt ?? null,
        updatedAt: ele?.updatedAt ?? null,
      }));

      return { categories: response, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  //SECTION: Method to update a role category
  async updateCategoryService(
    id: string,
    staffId: string,
    categoryType?: string,
    status?: boolean,
  ): Promise<any> {
    try {
      // Update category directly
      const updatedCategory = await RoleCategory.findByIdAndUpdate(
        id,
        {
          $set: {
            categoryType,
            status: status !== undefined ? status : true,
            updatedBy: staffId,
            updatedAt: getCurrentISTTime(),
          },
        },
        { new: true, runValidators: true },
      );

      if (!updatedCategory) {
        throw new NotFoundError(RECORD_NOT_FOUND("Category"));
      }

      return updatedCategory;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictError(
          `Category name '${categoryType}' already exists.`,
        );
      }
      throw new Error(error.message);
    }
  }
}

export default new RoleCategoryService();
