import Permission from "../models/permission.model";
import { getCurrentISTTime } from "../utils/lib";
import { SUCCESS_MESSAGES } from "../utils/messages";

const { CREATE_DATA } = SUCCESS_MESSAGES;

class PermissionService {
  //SECTION: Method to create a new permission
  createPermission = async (
    roleId: string,
    permission: any[],
    staffId: string
  ): Promise<string> => {
    try {
      const permissionEntries = permission.map((ele) => ({
        roleId,
        ...ele,
        createdBy: staffId,
        updatedBy: staffId,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      }));

      //NOTE: Insert or update permissions for the roleId
      await Permission.deleteMany({ roleId });
      await Permission.insertMany(permissionEntries);

      return CREATE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  //SECTION: Method to fetch permission of staff
  fetchPermissions = async (roleId: string): Promise<{ permission: any[] }> => {
    try {
      const permissions: any = await Permission.find({
        roleId,
        status: true,
      }).populate({ path: "routeId", select: "title link icon" });

      if (!permissions || permissions.length === 0) return { permission: [] };

      const data = permissions.map((item: any) => ({
        _id: item.routeId?._id,
        title: item.routeId?.title,
        link: item.routeId?.link,
        icon: item.routeId?.icon,
        add: item?.add,
        view: item?.view,
        edit: item?.edit,
        delete: item?.delete,
      }));

      return { permission: data };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };
}

export default new PermissionService();
