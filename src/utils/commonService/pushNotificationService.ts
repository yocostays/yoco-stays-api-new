import axios from "axios";

import { SUCCESS_MESSAGES } from "../../utils/messages";
import { TemplateTypes } from "../enum";

const { NOTIFICATION_SEND_SUCCESS } = SUCCESS_MESSAGES;

//NOTE: One signal configuration
const ONE_SIGNAL_APP_ID = process.env.ONE_SIGNAL_APP_ID;
const ONE_SIGNAL_KEY_ID = process.env.ONE_SIGNAL_KEY_ID;
const ONE_SIGNAL_API_URL = process.env.ONE_SIGNAL_API_URL;

export async function sendPushNotificationToUser(
  playerIds: any,
  templateHeading: string,
  templateDescription: string,
  imageUrl: string,
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
        big_picture: imageUrl,
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
