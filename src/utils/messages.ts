export const SUCCESS_MESSAGES = {
  CREATE_DATA: "Data has been created successfully.",
  UPDATE_DATA: "Data has been updated successfully.",
  DELETE_DATA: "Data has been deleted successfully.",
  FETCH_SUCCESS: "Data retrieved successfully.",
  USER_LOGIN_SUCCESS: "User LoggedIn Successfully.",
  USER_LOGOUT_SUCCESS: "User logout Successfully.",
  PASSWORD_RESET_SUCCESS: `You've successfully changed your password.`,
  MEAL_CANCELLED: `Meal canceled successfully. We hope to serve you next time!`,
  FILE_ON_PROCESS: "File uploading on process.It will update soon.",
  FILE_UPLOADED: "Upload complete! File is now available.",
  REFRESH_TOKEN: "Your session has been updated with a new refresh token.",
  GENERATE_OTP: "Your OTP has been generated and sent.",
  VERIFY_OTP: "Verification successful, your OTP has been validated!",
  NOTIFICATION_SEND_SUCCESS: (field: string) => {
    return `Push notification for ${field} send successfully.`;
  },
  OTP_SENT_SUCCESS: "OTP send successful.",
  COLLEGE_AND_RELATED_ENTITIES_ACTIVATED: (field: string) =>
    `${field} and related entities activated.`,
};

export const ERROR_MESSAGES = {
  RECORD_NOT_FOUND: (field?: string) => {
    return field ? `${field} not found.` : "Record not found.";
  },
  DUPLICATE_RECORD: (field: string) => {
    return field
      ? `Duplicate record found in ${field}.`
      : "Duplicate record found.";
  },
  INVALID_DATE_RANGE: "Please provide a valid date range to proceed.",
  INVALID_CREDENTIALS: "Invalid credentials provided.",
  TOTAL_CAPACITY_ISSUES: "University capacity reached. Please contact support.",
  AUTH_FAILED: "Authentication failed.",
  UNIQUE_GENERATE_FAILED: "Failed to generate yoco uniqueId.",
  SERVER_ERROR: "An error occurred on the server. Please try again later.",
  USER_NOT_ACTIVE: "Account not active. Please contact support.",
  UNAUTHORIZED_ACCESS:
    "Access denied: You do not have permission to perform this action.",
  START_DATE_ERROR: "The start date cannot be before today's date.",
  IMAGE_UPLOAD_ERROR: "Error occurred during image upload to S3 bucket.",
  COMPLAINT_ALREADY_RESOLVED: (field?: string) =>
    `Complaint is already marked as ${field}. No further staff assignment allowed.`,
  LEAVE_APPLY: "You have already applied for leave during this period.",
  INVALID_STATUS: "Invalid status provided.",
  OTP_EXPIRED: "OTP has expired. Please request a new OTP.",
  OTP_NOT_FOUND_With_PHONE: "OTP record not found for the given phone number.",
  OTP_NOT_FOUND: "Invalid OTP. Please try again.",
  PASSWROD_RESET_ISSUES: "User password reset have issues.",
  SIGNED_URL: "Failed to get a signed URL.",
  LEAVE_APPROVE_ERROR:
    "Gatepass generation failed: Leave request not yet approved.",
  OTP_NOT_VERIFIED:
    "OTP verification failed. Please enter the correct OTP to proceed.",
  LEAVE_STATUS_UPDATE: (field?: string) => {
    return field
      ? `Leave already ${field}. Can't update it`
      : "Can't update the leave.";
  },
  INVALID_ROUTE_ID: "Invalid route ID. Please check and try again.",
  INACTIVE_USER:
    "This account is temporarily inactive. For help, please contact support.",
  UPLOAD_DOUMENT_ERROR: "Hostel does not require agreement documents.",
  NO_DOCUMENTS_FOUND: "No documnet found for this hostel.",
  NO_DATA_IN_GIVEN_DATE: "No menu available between given date.",
  BOOKMEAL_ERROR: "Gatepass generation failed: BookMeal request cancelled.",
  COMPLAIN_APPLY_ERROR: "Student on Leave. Cannot add complain.",
  COMPLAINT_UPDATE_ERROR: (field?: string) =>
    `Complaint is already marked as ${field}.`,
  NO_ASSIGNED_STAFF: "Some complaints have no assigned staff.",
  ONE_SIGNAL_PLAYERS_NOT_FOUND: "No OneSignal player IDs found for user.",
  NO_HOSTEL_FOR_THIS_STUDENT: `No hostel found for this student.`,
  ALLOCATE_HOSTEL_STUDENT_TO_ACTIVE: "Please allocate hostel to active.",
  BED_TYPE_MISMATCH: (field: number, field2: string, field3: number) =>
    `Bed count (${field}) doesn't match bed type '${field2}' (should be ${field3})`,
  USER_STILL_ACTIVE:
    "Cannot mark student as left while they are still active in the hostel.",
};

export const VALIDATION_MESSAGES = {
  INVALID_PAYLOAD:
    "Invalid request payload. Please ensure all required fields are provided and correctly formatted.",
  REQUIRED_FIELD: (field: string) => `${field} is required.`,
  INVALID_FIELD: (field: string) => `${field} is not valid.`,
  ALREADY_EXIST_FIELD_ONE: (field: string) => `${field} already exists.`,
  ALREADY_EXIST_FIELD_TWO: (field: string, fieldTwo: string) =>
    `${field} and ${fieldTwo} already exists.`,
  INVALID_ID: "The id provided is not valid.",
  INVALID_EMAIL: "The email provided is not valid.",
  PASSWORD_TOO_SHORT: "Password must be at least 6 characters long.",
  INVALID_PASSWORD: "The password you entered is incorrect. Please try again.",
  STAFF_ROLE_INVALID: "Staff does not have the required role.",
  MESS_MENU_ALREADY_EXIST:
    "A mess menu for this date and hostel already exists.",
  EXPIRY_TIME_ERROR: `Invalid duration provided. Use 'D' for days, 'H' for hours, 'M' for minutes, or 'S' for seconds.`,
  INVALID_TIME_FORMAT: (field: string) =>
    `Invalid startTime or endTime for allowed ${field}.`,
  LEAVE_UPDATE_ISSUES:
    "Each leave object must contain valid leaveId, status, and remark.",
  COMPLAIN_UPDATE_ISSUES:
    "Each complain object must contain valid complainId, status, and remark.",
  SAME_DATE: "You have already add wastage in these dates.",
  INVALID_REPORT_TYPE: (field: string) => `Invalid ${field} type`,
  INVALID_BILLING_CYCLE:
    "Billing cycle type is incorrect. Please check and try again.",
};
