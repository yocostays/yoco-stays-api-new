import { Types } from "mongoose";
import GlobalTemplate from "../models/globalTemplate.model";
import HostelTemplate from "../models/hostelTemplate.model";
import { TemplateTypes } from "../utils/enum";
import { ERROR_MESSAGES } from "../utils/messages";

const { RECORD_NOT_FOUND } = ERROR_MESSAGES;

class NotificationTemplateAdapter {
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  // Fetch notification template with hostel-specific override support
  async getNotificationTemplate(
    templateType: TemplateTypes,
    hostelId?: string | Types.ObjectId
  ): Promise<{
    heading: string;
    body: string;
    extraData?: any;
  }> {
    try {
      // Generate cache key
      const cacheKey = `notification_${templateType}_${hostelId || "global"}`;

      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      let notificationData: any = null;
      let globalSubData: any = null;
      let globalSubId: string | null = null;

      // 1. Find the target Global Subcategory first (providing stable ID)
      const globalTemplate = await GlobalTemplate.findOne({
        $or: [
          { "subcategories.meta.templateType": templateType },
          { "subcategories.title": { $regex: new RegExp(`^${templateType}$`, "i") } }
        ],
        scope: "global",
        isActive: true,
        isDeleted: false,
      }).lean() as any;

      if (globalTemplate) {
        globalSubData = globalTemplate.subcategories.find(
          (sc: any) =>
            sc.meta?.templateType === templateType ||
            sc.title?.toLowerCase() === templateType.toLowerCase()
        );
        globalSubId = globalSubData?._id?.toString();

        if (globalSubId) {
          console.log(`  [Global] Found: "${globalSubData.title}" (ID: ${globalSubId})`);
        }
      } else {
        console.log(`  [Global] No GlobalTemplate/Subcategory found for: ${templateType}`);
      }

      // 2. Try to find hostel-specific override using Global ID or falling back to type/title
      if (hostelId) {
        const hostelTemplate = await HostelTemplate.findOne({
          hostelId: new Types.ObjectId(hostelId as string),
          isActive: true,
          isDeleted: false,
        }).lean() as any;

        if (hostelTemplate) {
          // Robust matching: originalSubcategoryId OR templateType OR title
          const hostelSubcategory = hostelTemplate.subcategories.find((sc: any) => {
            const matchesId = globalSubId && sc.originalSubcategoryId?.toString() === globalSubId;
            const matchesType = sc.meta?.templateType === templateType;
            const matchesTitle = sc.title?.toLowerCase() === templateType.toLowerCase();
            return matchesId || matchesType || matchesTitle;
          });

          if (hostelSubcategory) {
            const hasCustomTemplate =
              hostelSubcategory.notificationTemplate?.heading &&
              hostelSubcategory.notificationTemplate?.body;


            notificationData = {
              heading:
                hostelSubcategory.notificationTemplate?.heading ||
                hostelSubcategory.title ||
                "Notification",
              body:
                hostelSubcategory.notificationTemplate?.body ||
                hostelSubcategory.description ||
                "You have a new update.",
              extraData: hostelSubcategory.notificationTemplate?.actionData || {},
            };
          } else {
          }
        }
      }

      // 3. Fallback to global template data if no hostel-specific override found
      if (!notificationData && globalSubData) {
        notificationData = {
          heading:
            globalSubData.notificationTemplate?.heading ||
            globalSubData.title ||
            "Notification",
          body:
            globalSubData.notificationTemplate?.body ||
            globalSubData.description ||
            "You have a new update.",
          extraData: globalSubData.notificationTemplate?.actionData || {},
        };
      }

      if (!notificationData) {
        throw new Error(
          RECORD_NOT_FOUND(`Notification template for ${templateType}`)
        );
      }

      this.setCache(cacheKey, notificationData);

      return notificationData;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch notification template: ${error.message}`
      );
    }
  }

  // Populate dynamic placeholders in template string
  
  populatePlaceholders(template: string, data: Record<string, any>): string {
    if (!template) return "";

    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined && data[key] !== null
        ? String(data[key])
        : match;
    });
  }

  // Get populated notification template ready to send
   
  async getPopulatedTemplate(
    templateType: TemplateTypes,
    hostelId: string | Types.ObjectId | undefined,
    dynamicData: Record<string, any>
  ): Promise<{
    heading: string;
    body: string;
    extraData?: any;
  }> {
    const template = await this.getNotificationTemplate(templateType, hostelId);

    return {
      heading: this.populatePlaceholders(template.heading, dynamicData),
      body: this.populatePlaceholders(template.body, dynamicData),
      extraData: {
        ...template.extraData,
        templateType,
      },
    };
  }

  // Clear cache for specific template or all templates
  
  clearCache(templateType?: TemplateTypes, hostelId?: string): void {
    if (templateType) {
      const cacheKey = `notification_${templateType}_${hostelId || "global"}`;
      this.cache.delete(cacheKey);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get data from cache if not expired
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Set data in cache with TTL
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL,
    });
  }
}

export default new NotificationTemplateAdapter();
