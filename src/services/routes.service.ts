import Route, { IRoute } from "../models/route.model";
import { getCurrentISTTime } from "../utils/lib";
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from "../utils/messages";
import { paginateAggregate } from "../utils/pagination";
import { ConflictError } from "../utils/errors";

const { RECORD_NOT_FOUND, DUPLICATE_RECORD } = ERROR_MESSAGES;
const { DELETE_DATA, UPDATE_DATA } = SUCCESS_MESSAGES;

class RoutesService {
  //SECTION: Method to create a new routes
  createNewRoutes = async (
    title: string,
    link: string,
    icon: string,
    platform: string,
    staffId: string,
  ): Promise<IRoute> => {
    // Check for duplicate route (same title or link) on the same platform
    const existingRoute = await Route.findOne({
      platform,
      $or: [
        { title: { $regex: new RegExp(`^${title}$`, "i") } },
        { link: { $regex: new RegExp(`^${link}$`, "i") } },
      ],
    });

    if (existingRoute) {
      throw new ConflictError(
        DUPLICATE_RECORD(
          `Route with title '${title}' or link '${link}' already exists for platform '${platform}'`,
        ),
      );
    }

    // Generate uniqueId
    const lastRoute = await Route.findOne().sort({ createdAt: -1 });
    let uniqueId = "RO1"; // Default start
    if (lastRoute && lastRoute.uniqueId) {
      const lastId = parseInt(lastRoute.uniqueId.replace("RO", ""), 10);
      uniqueId = `RO${lastId + 1}`;
    }

    const newRoutes = new Route({
      uniqueId,
      title,
      link,
      icon,
      platform,
      createdBy: staffId,
      createdAt: getCurrentISTTime(),
    });

    return await newRoutes.save();
  };

  //SECTION: Method to get all routes
  allRoutesDetails = async (
    platform?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    web: any[];
    mobile: any[];
    pagination: {
      totalCount: number;
      totalPages: number;
      currentPage: number;
      startIndex: number;
      endIndex: number;
    };
  }> => {
    const formatRoute = (item: any) => ({
      _id: item._id,
      uniqueId: item.uniqueId,
      title: item.title,
      link: item.link,
      icon: item.icon,
      platform: item.platform,
      add: false,
      view: false,
      edit: false,
      delete: false,
      status: item?.status,
    });

    const pipeline: any[] = [{ $match: { status: true } }];

    if (platform) {
      pipeline[0].$match.platform = platform;
    }

    pipeline.push({ $sort: { platform: -1, createdAt: -1 } });

    const { data, count } = await paginateAggregate(
      Route,
      pipeline,
      page,
      limit,
    );

    const formattedData = data.map(formatRoute);
    const webRoutes = formattedData.filter((r: any) => r.platform === "web");
    const mobileRoutes = formattedData.filter(
      (r: any) => r.platform === "mobile",
    );

    const totalPages = Math.ceil(count / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, count);

    return {
      web: webRoutes,
      mobile: mobileRoutes,
      pagination: {
        totalCount: count,
        totalPages,
        currentPage: page,
        startIndex: startIndex + 1,
        endIndex,
      },
    };
  };

  //SECTION: Method to update route by id
  async updateRouteById(
    id: string,
    staffId: string,
    data: Partial<IRoute>,
  ): Promise<string> {
    // Check for duplicate route (same title or link) on the same platform, excluding current route
    if (data.title || data.link) {
      const existingRoute = await Route.findOne({
        platform: data.platform || (await Route.findById(id))?.platform,
        status: true,
        _id: { $ne: id }, // Exclude current route
        $or: [
          ...(data.title
            ? [{ title: { $regex: new RegExp(`^${data.title}$`, "i") } }]
            : []),
          ...(data.link
            ? [{ link: { $regex: new RegExp(`^${data.link}$`, "i") } }]
            : []),
        ],
      });

      if (existingRoute) {
        throw new ConflictError(
          `Route with title '${data.title}' or link '${data.link}' already exists for this platform.`,
        );
      }
    }

    const route = await Route.findByIdAndUpdate(id, {
      $set: {
        ...data,
        updatedBy: staffId,
        updatedAt: getCurrentISTTime(),
      },
    });

    if (!route) throw new Error(RECORD_NOT_FOUND("Route"));

    return UPDATE_DATA;
  }

  //SECTION: Method to delete route by id
  async deleteRouteById(id: string): Promise<string> {
    const route = await Route.findByIdAndDelete(id);

    if (!route) throw new Error(RECORD_NOT_FOUND("Route"));

    return DELETE_DATA;
  }
}

export default new RoutesService();
