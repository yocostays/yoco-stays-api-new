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
    image?: string;
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

      // Try to find hostel-specific template first (if hostelId provided)
      if (hostelId) {
        const hostelTemplate = await HostelTemplate.findOne({
          hostelId: new Types.ObjectId(hostelId as string),
          isActive: true,
          isDeleted: false,
        }).lean();

        if (hostelTemplate) {
          // Find matching subcategory by templateType in global template
          const globalTemplate = await GlobalTemplate.findById(
            hostelTemplate.globalTemplateId
          ).lean();

          if (globalTemplate) {
            const globalSubcategory = globalTemplate.subcategories.find(
              (sc: any) => sc.meta?.templateType === templateType
            );

            // Check if hostel has custom notification template
            const hostelSubcategory = hostelTemplate.subcategories.find(
              (sc: any) =>
                sc.originalSubcategoryId?.toString() ===
                globalSubcategory?._id?.toString()
            );

            if (
              hostelSubcategory?.notificationTemplate?.heading &&
              hostelSubcategory?.notificationTemplate?.body
            ) {
              notificationData = {
                heading: hostelSubcategory.notificationTemplate.heading,
                body: hostelSubcategory.notificationTemplate.body,
                image: hostelSubcategory.notificationTemplate.imageUrl || null,
                extraData:
                  hostelSubcategory.notificationTemplate.actionData || {},
              };
            }
          }
        }
      }

      // Fallback to global template if no hostel-specific found
      if (!notificationData) {
        const globalTemplate = await GlobalTemplate.findOne({
          "subcategories.meta.templateType": templateType,
          scope: "global",
          isActive: true,
          isDeleted: false,
        }).lean();

        if (!globalTemplate) {
          throw new Error(
            RECORD_NOT_FOUND(`Notification template for ${templateType}`)
          );
        }

        const subcategory = globalTemplate.subcategories.find(
          (sc: any) => sc.meta?.templateType === templateType
        );

        if (!subcategory) {
          throw new Error(
            `Subcategory not found for template type ${templateType}`
          );
        }

        //If notificationTemplate is missing, use subcategory title/description
        if (
          !subcategory.notificationTemplate?.heading ||
          !subcategory.notificationTemplate?.body
        ) {
          notificationData = {
            heading: subcategory.title || "Notification",
            body: subcategory.description || "You have a new notification.",
            image: null,
            extraData: {},
          };
        } else {
          // Use notificationTemplate if available
          notificationData = {
            heading: subcategory.notificationTemplate.heading,
            body: subcategory.notificationTemplate.body,
            image: subcategory.notificationTemplate.imageUrl || null,
            extraData: subcategory.notificationTemplate.actionData || {},
          };
        }
      }

      this.setCache(cacheKey, notificationData);

      return notificationData;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch notification template: ${error.message}`
      );
    }
  }

  /**
   * Populate dynamic placeholders in template string
   * Supports {{variableName}} syntax
   *
   * @param template - Template string with {{placeholders}}
   * @param data - Key-value pairs for replacement
   * @returns Populated string
   */
  populatePlaceholders(template: string, data: Record<string, any>): string {
    if (!template) return "";

    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined && data[key] !== null
        ? String(data[key])
        : match;
    });
  }

  /**
   * Get populated notification template ready to send
   * Combines fetching and placeholder replacement
   *
   * @param templateType - TemplateTypes enum
   * @param hostelId - Optional hostel ID
   * @param dynamicData - Data for placeholder replacement
   * @returns Ready-to-send notification data
   */
  async getPopulatedTemplate(
    templateType: TemplateTypes,
    hostelId: string | Types.ObjectId | undefined,
    dynamicData: Record<string, any>
  ): Promise<{
    heading: string;
    body: string;
    image?: string;
    extraData?: any;
  }> {
    const template = await this.getNotificationTemplate(templateType, hostelId);

    return {
      heading: this.populatePlaceholders(template.heading, dynamicData),
      body: this.populatePlaceholders(template.body, dynamicData),
      image: template.image,
      extraData: {
        ...template.extraData,
        templateType,
      },
    };
  }

  /**
   * Clear cache for specific template or all templates
   * Useful after template updates
   *
   * @param templateType - Optional specific template to clear
   * @param hostelId - Optional hostel ID
   */
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
