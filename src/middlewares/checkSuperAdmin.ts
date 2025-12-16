//this middleware checks if the user is a super admin
import { Request, Response, NextFunction } from "express";
export const checkSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // Check if user is authenticated
    const userId = req.body._valid?._id ? String(req.body._valid._id) : undefined;
    const userType = req.body._valid?.userType;

    if (!userId) {
      return res.status(401).json({
        statusCode: 401,
        message: "Authentication required"
      });
    }

    // Only staff can be superadmin
    if (userType !== "staff") {
      return res.status(403).json({
        statusCode: 403,
        message: "Access denied. Staff access required."
      });
    }

    // Import services dynamically to avoid circular dependencies
    const StaffService = (await import("../services/staff.service")).default;
    const RoleService = (await import("../services/role.service")).default;

    // Get staff details
    const { staff } = await StaffService.getStaffById(userId);

    if (!staff) {
      return res.status(404).json({
        statusCode: 404,
        message: "Staff not found"
      });
    }

    // Get role details
    // roleId could be an object (populated) or ObjectId, handle both cases
    const roleId = typeof staff.roleId === 'object' && staff.roleId !== null 
      ? String((staff.roleId as any)._id || staff.roleId) 
      : String(staff.roleId);
    const { role } = await RoleService.getRoleById(roleId);

    if (!role) {
      return res.status(404).json({
        statusCode: 404,
        message: "Role not found"
      });
    }

    // Check if role name is "Super Admin" (case-insensitive, handles spaces)
    const isSuperAdmin = /^super\s*admin$/i.test(role.name);

    if (!isSuperAdmin) {
      return res.status(403).json({
        statusCode: 403,
        message: "Access denied. Super Admin access required."
      });
    }

    // User is superadmin, proceed to next middleware/controller
    next();

  } catch (error: any) {
    console.error("[checkSuperAdmin] Error:", error);
    return res.status(500).json({
      statusCode: 500,
      message: error.message || "Failed to verify admin access"
    });
  }
};
