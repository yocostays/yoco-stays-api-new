import Permission from "../models/permission.model";
import { getCurrentISTTime } from "../utils/lib";
import { SUCCESS_MESSAGES } from "../utils/messages";

const { CREATE_DATA } = SUCCESS_MESSAGES;

class PermissionService {
  //SECTION: Method to create a new permission
  createPermission = async (
    roleId: string,
    permission: any[],
    staffId: string,
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
  fetchPermissions = async (
    roleId: string,
  ): Promise<{ web: any[]; mobile: any[] }> => {
    try {
      const permissions: any = await Permission.find({
        roleId,
        status: true,
      }).populate({ path: "routeId", select: "title link icon platform" });

      if (!permissions || permissions.length === 0)
        return { web: [], mobile: [] };

      const data = permissions.map((item: any) => ({
        _id: item.routeId?._id,
        title: item.routeId?.title,
        link: item.routeId?.link,
        icon: item.routeId?.icon,
        platform: item.routeId?.platform,
        add: item?.add,
        view: item?.view,
        edit: item?.edit,
        delete: item?.delete,
      }));

      // Split permissions into web and mobile
      const webPermissions = data.filter((p: any) => p.platform === "web");
      const mobilePermissions = data.filter(
        (p: any) => p.platform === "mobile",
      );

      return { web: webPermissions, mobile: mobilePermissions };
    } catch (error: any) {
      throw new Error(error.message);
    }
  };
}

export default new PermissionService();
