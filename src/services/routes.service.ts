import Route, { IRoute } from "../models/route.model";
import { getCurrentISTTime } from "../utils/lib";
import {SUCCESS_MESSAGES, ERROR_MESSAGES } from "../utils/messages";

const { RECORD_NOT_FOUND } = ERROR_MESSAGES;
const { DELETE_DATA } = SUCCESS_MESSAGES;


class RoutesService {
  //SECTION: Method to create a new routes
  createNewRoutes = async (
    title: string,
    link: string,
    icon: string
  ): Promise<IRoute> => {
    try {
      const newRoutes = new Route({
        title,
        link,
        icon,
        createdAt: getCurrentISTTime(),
        updatedAt: getCurrentISTTime(),
      });

      return await newRoutes.save();
    } catch (error: any) {
      throw new Error(`Failed to create routes: ${error.message}`);
    }
  };

  //SECTION: Method to create a new routes
  allRoutesDetails = async (): Promise<{ count: number; routes: any[] }> => {
    try {
      // Run both queries in parallel
      const [routes, count] = await Promise.all([
        Route.find({ status: true }),
        Route.countDocuments({ status: true }),
      ]);

      //NOTE - push final data
      const result = await Promise.all(
        routes.map(async (item) => {
          return {
            _id: item._id,
            title: item.title,
            link: item.link,
            icon: item.icon,
            add: false,
            view: false,
            edit: false,
            delete: false,
            status: item?.status,
          };
        })
      );

      return { count, routes: result };
    } catch (error: any) {
      throw new Error(`Failed to get routes: ${error.message}`);
    }
  };

  //SECTION: Method to delete route by id
  async deleteRouteById(id: string): Promise<string> {
    try {
      const route = await Route.findByIdAndDelete(id);

      if (!route) throw new Error(RECORD_NOT_FOUND("Route"));

      return DELETE_DATA;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
}

export default new RoutesService();
