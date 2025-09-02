import RoleService from "../services/role.service";
import BulkUpload from "../models/bulkUpload.model";
import { BulkUploadTypes } from "../utils/enum";
import { getSignedUrl } from "../utils/awsUploadService";

const { getRoleById } = RoleService;

class BulkUploadService {
  //SECTION: Method to get all bulk uploaded data
  allBulkUploadedFiles = async (
    staffId: string,
    roleId: string,
    page: number,
    limit: number,
    fileType?: BulkUploadTypes
  ): Promise<{ count: number; bulkData: any[] }> => {
    try {
      // Calculate the number of documents to skip
      const skip = (page - 1) * limit;

      // Get role name based on the roleId
      const { role } = await getRoleById(roleId);

      // Define a query condition
      let queryCondition: any = {};

      // If the role is superAdmin, get all data
      if (/superAdmin/i.test(role.name)) {
        queryCondition = {};
      } else {
        queryCondition = { createdBy: staffId };
      }

      if (fileType) {
        queryCondition.fileType = fileType;
      }

      // Run both queries in parallel
      const [bulkData, count] = await Promise.all([
        BulkUpload.find(queryCondition)
          .populate([{ path: "createdBy", select: "name" }])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        BulkUpload.countDocuments(queryCondition),
      ]);

      if (!bulkData) {
        return { bulkData: [], count: 0 };
      }

      const response = await Promise.all(
        bulkData.map(async (ele) => ({
          _id: ele._id,
          fileType: ele?.fileType ?? null,
          originalFile: ele?.originalFile
            ? await getSignedUrl(ele?.originalFile)
            : null,
          successFile: ele?.successFile
            ? await getSignedUrl(ele?.successFile)
            : null,
          errorFile: ele?.errorFile ? await getSignedUrl(ele?.errorFile) : null,
          status: ele?.status ?? null,
          createdBy: (ele?.createdBy as any)?.name ?? null,
          createdAt: ele?.createdAt ?? null,
        }))
      );

      return { bulkData: response, count };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };
}

export default new BulkUploadService();
