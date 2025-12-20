import axios from "axios";
import { Types } from "mongoose";
import { SUCCESS_MESSAGES } from "../../utils/messages";
import { TemplateTypes } from "../enum";
import notificationTemplateAdapter from "../../services/notificationTemplateAdapter.service";

const { NOTIFICATION_SEND_SUCCESS } = SUCCESS_MESSAGES;

//NOTE: One signal configuration
const ONE_SIGNAL_APP_ID = process.env.ONE_SIGNAL_APP_ID;
const ONE_SIGNAL_KEY_ID = process.env.ONE_SIGNAL_KEY_ID;
const ONE_SIGNAL_API_URL = process.env.ONE_SIGNAL_API_URL;

export async function sendPushNotificationToUser(
  playerIds: any,
  templateHeading: string,
  templateDescription: string,
  templateType: TemplateTypes,
  extraData: Record<string, any> = {}
): Promise<string> {
  try {
    await axios.post(
      ONE_SIGNAL_API_URL as string,
      {
        app_id: ONE_SIGNAL_APP_ID,
        include_player_ids: playerIds,
        headings: { en: templateHeading },
        contents: { en: templateDescription },
        data: extraData,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${ONE_SIGNAL_KEY_ID}`,
        },
      }
    );

    return NOTIFICATION_SEND_SUCCESS(templateType);
  } catch (error: any) {
    throw new Error(error.message);
  }
}

// Improved version of push notification sender
export async function sendPushNotificationV2(
  playerIds: any[],
  templateType: TemplateTypes,
  hostelId?: string | Types.ObjectId,
  dynamicData: Record<string, any> = {},
  extraData: Record<string, any> = {}
): Promise<string> {
  try {
    // Filter out null/undefined player IDs
    const validPlayerIds = playerIds.filter(Boolean);

    if (validPlayerIds.length === 0) {
      throw new Error("No valid player IDs provided for notification");
    }

    // Fetch and populate template from new system
    const template = await notificationTemplateAdapter.getPopulatedTemplate(
      templateType,
      hostelId,
      dynamicData
    );

    // Merge extra data
    const finalExtraData = {
      ...template.extraData,
      ...extraData,
    };

    // Send to OneSignal
    await axios.post(
      ONE_SIGNAL_API_URL as string,
      {
        app_id: ONE_SIGNAL_APP_ID,
        include_player_ids: validPlayerIds,
        headings: { en: template.heading },
        contents: { en: template.body },
        data: finalExtraData,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${ONE_SIGNAL_KEY_ID}`,
        },
      }
    );

    return NOTIFICATION_SEND_SUCCESS(templateType);
  } catch (error: any) {
    // Enhanced error logging for production debugging
    console.error(
      `[Push Notification Error] Type: ${templateType}, Error: ${error.message}`
    );
    throw new Error(`Push notification failed: ${error.message}`);
  }
}

// Batch sending function
export async function sendBatchPushNotifications(
  notifications: Array<{
    playerIds: any[];
    templateType: TemplateTypes;
    hostelId?: string | Types.ObjectId;
    dynamicData?: Record<string, any>;
    extraData?: Record<string, any>;
  }>
): Promise<
  Array<{ success: boolean; templateType: TemplateTypes; error?: string }>
> {
  const results = await Promise.allSettled(
    notifications.map((notification) =>
      sendPushNotificationV2(
        notification.playerIds,
        notification.templateType,
        notification.hostelId,
        notification.dynamicData,
        notification.extraData
      ).then(() => ({ success: true, templateType: notification.templateType }))
    )
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      return {
        success: false,
        templateType: notifications[index].templateType,
        error: result.reason?.message || "Unknown error",
      };
    }
  });
}
