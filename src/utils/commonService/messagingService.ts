import axios from "axios";

import { otpVerificationMessage } from "./smsTemplatesService";
import { SUCCESS_MESSAGES } from "../../utils/messages";

const { OTP_SENT_SUCCESS } = SUCCESS_MESSAGES;

//SECTION: Messaging service key configuration.
const ApiKey: any = process.env.API_KEY;
const Sender = process.env.SENDER;
const DltEntityId = process.env.DLT_ENTITY_ID;
const MessageType = process.env.MESSAGE_TYPE;
const BaseUrl = process.env.BASE_URL;
const DltTemplateId = process.env.DltSmsTemplateId;

//SECTION: Method to send sms to user.
export async function sendSMS(phone: string, otp: string | number) {
  try {
    //NOTE: Encode the message which is user in below url.
     const otpStr = typeof otp === "number" ? String(otp).padStart(6, "0") : String(otp);
    const encodedMessage = encodeURIComponent(otpVerificationMessage(Number(otpStr)));

    const url = `${BaseUrl}?sender=${Sender}&numbers=91${phone}&message=${encodedMessage}&messagetype=${MessageType}&response=Y`;

    const params = {
      apikey: ApiKey,
      dltentityid: DltEntityId,
      dlttempid: DltTemplateId,
      tmid: process.env.TMID,
    };

    await axios.get(url, { params });
    return OTP_SENT_SUCCESS;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
