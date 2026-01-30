export enum Gender {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
  NOT_SELECTED = "not selected",
}

export enum AccountType {
  STUDENT = "student",
  STAFF = "staff",
}

export enum BedTypes {
  SINGLE = 1,
  DOUBLE = 2,
  TRIPLET = 3,
  QUADRILLE = 4,
}

export enum BloodGroupType {
  A_POSITIVE = "A+",
  A_NEGATIVE = "A-",
  B_POSITIVE = "B+",
  B_NEGATIVE = "B-",
  AB_POSITIVE = "AB+",
  AB_NEGATIVE = "AB-",
  O_POSITIVE = "O+",
  O_NEGATIVE = "O-",
}

export enum RoomMaintenanceStatusType {
  PENDING = "pending",
  IN_PROGRESS = "in progress",
  COMPLETED = "completed",
  NOT_REQUIRED = "not required",
}

export enum RoomCoolingType {
  AC = "ac",
  NON_AC = "non ac",
}

export enum BillingCycleTypes {
  ANNUAL = "annual",
  SEMI_ANNUAL = "semi-annual",
  QUARTERLY = "quarterly",
  MONTHLY = "monthly",
  ONE_SHOT = "one shot",
}

export enum PaymentStatusTypes {
  PENDING = "pending",
  PAID = "paid",
  PARTIALLY_PAID = "partially paid",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export enum VechicleTypes {
  BICYCLE = "bicycle",
  BIKE = "bike",
  FOUR_WHEELER = "four wheeler",
}

export enum VehicleEngineTypes {
  EV = "ev",
  FUEL = "fuel",
  NOT_REQUIRED = "not required",
}

export enum DaysTypes {
  SUNDAY = "sunday",
  MONDAY = "monday",
  TUESDAY = "tuesday",
  WEDNESDAY = "wednesday",
  THURSDAY = "thursday",
  FRIDAY = "friday",
  SATURDAY = "saturday",
}

export enum MealBookingStatusTypes {
  BOOKED = "booked",
  PARTIALLY_BOOKED = "partially booked",
  PARTIALLY_CANCELLED = "partially cancelled",
  CANCELLED = "cancelled",
  SKIPPED = "skipped",
  NOT_BOOKED = "not booked",
  GUEST_BOOKED = "guest booked",
}

/**
 * Booking intent per meal - represents what the student intended for a specific meal.
 * Used in the new meals state machine for granular tracking.
 */
export enum MealBookingIntent {
  CONFIRMED = "CONFIRMED", // Student actively booked this meal
  CANCELLED = "CANCELLED", // Student actively cancelled this meal
  NOT_APPLICABLE = "N/A", // Meal was never booked (null-equivalent)
  PENDING = "PENDING", // No decision yet
  SKIPPED = "SKIPPED", // Student explicitly skipped this meal
}

// Source of meal cancellation for audit and tracking purposes.
export enum MealCancelSource {
  MANUAL = "manual", // User cancelled manually
  LEAVE = "leave", // Cancelled due to approved leave
  SYSTEM = "system", // System-triggered cancellation
}

/**
 * Derived status for reporting and display purposes.
 * Calculated based on booking intent and consumption status.
 */
export enum MealDerivedStatus {
  CONSUMED = "CONSUMED",
  MISSED = "MISSED",
  SKIPPED = "SKIPPED",
  SKIPPED_CONSUMED = "SKIPPED_CONSUMED",
  NOT_BOOKED = "NOT_BOOKED",
}

export enum ComplainStatusTypes {
  ALL = "all",
  PENDING = "pending",
  IN_PROGRESS = "in progress",
  ON_HOLD = "on hold",
  LONG_TERM_WORK = "long term work",
  REJECTED = "rejected",
  WORK_COMPLETED = "work completed",
  ESCALATED = "escalated",
  RESOLVED = "resolved",
  CANCELLED = "cancelled",
}

export enum LeaveStatusTypes {
  ALL = "all",
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
}

export enum LeaveApproveStatusTypes {
  PARENT = "parent",
  HOD = "hod",
  WARDEN = "warden",
  STUDENT = "student",
  PENDING_APPROVAL = "pending approval",
}

export enum UserGetByTypes {
  ALL = "all",
  ACTIVE = "active",
  INACTIVE = "inActive",
  AUTHORIZE = "authorize",
  LEFT_USER = "left user",
  NEW = "new",
}

export enum UserKycUploadTypes {
  AADHARCARD = "aadhaarCard",
  PASSPORT = "passport",
  VOTER_CARD = "voterCard",
  DRIVING_LICENSE = "drivingLicense",
  PAN_CARD = "panCard",
}

export enum FetchUserTypes {
  HOSTEL = "hostel",
  PERSONAL = "personal",
  FAMILY = "family",
  KYC = "kyc",
  INDISCIPLINARY = "indisciplinary",
  VEHICLE = "vehicle",
  ACADEMIC = "academic",
}

export enum LeaveTypes {
  ALL = "all",
  LEAVE = "leave",
  DAY_OUT = "day out",
  LATE_COMING = "late coming",
}

export enum ReportDropDownTypes {
  TODAY = "today",
  TOMORROW = "tomorrow",
  YESTERDAY = "yesterday",
  CURRENT_WEEK = "current week",
  LAST_WEEK = "last week",
  PAST_TWO_WEEK = "past two week",
  CURRENT_MONTH = "current month",
  LAST_MONTH = "last month",
  CURRENT_YEAR = "current year",
  LAST_YEAR = "last year",
  CUSTOM = "custom",
}

export enum MealConsumedType {
  CONSUMPTION = "consumption",
  DEFAULTER = "defaulter",
  CANCELLED = "cancelled",
}

export enum MealCountReportType {
  ALL = "all",
  BREAKFAST = "breakfast",
  LUNCH = "lunch",
  DINNER = "dinner",
  HI_TEA = "hi-tea",
  FULL_DAY = "full day",
}

export enum BulkUploadTypes {
  USER = "user",
  MEAL = "meal",
  FOOD_WASTAGE = "food wastage",
  HOSTEL = "hostel",
  HOSTEL_ROOM_MAP = "hostel room map",
}

export enum HostelTypes {
  BOYS = "boys",
  GIRLS = "girls",
  CO_ED = "co-ed",
}

export enum RoomTypes {
  SINGLE = "single",
  DOUBLE = "double",
  TRIPLET = "triplet",
  QUADRILLE = "quadrille",
  SHARING = "sharing",
}

export enum MealTypes {
  VEGETARIAN = "vegetarian",
  NON_VEGETARIAN = "non vegetarian",
  VEGAN = "vegan",
}

export enum WeekDaysTypes {
  SUNDAY = "sunday",
  MONDAY = "monday",
  TUESDAY = "tuesday",
  WEDNESDAY = "wednesday",
  THURSDAY = "thursday",
  FRIDAY = "friday",
  SATURDAY = "saturday",
}

export enum OccupancyTypes {
  REGULAR = "regular",
  TEMPORARY = "temporary",
  GUEST = "guest",
}

export enum WashroomTypes {
  ATTACHED = "attatched",
  COMMON = "common",
}

export enum DietaryOptionsTypes {
  JAIN_FOOD = "jain food",
  GLUTEN_FREE = "gluteen free",
}

export enum CategoryTypes {
  NOT_SELECTED = "not selected",
  OPEN = "open",
  VJ = "vj",
  NT = "nt",
  GENERAL = "general",
  OBC = "obc",
  SC = "sc",
  ST = "st",
  SBC = "sbc",
  OTHER = "other",
}

export enum SchemeReferenceModelTypes {
  USER = "User",
  STAFF = "staff",
}

export enum SortingTypes {
  ASCENDING = "ascending",
  DESCENDING = "descending",
  RECENT = "recent",
  OLDEST = "oldest",
  CUSTOM = "custom",
}

export enum ExportTypes {
  ALL = "all",
  INDIVIDUAL = "individual",
}

export enum UnitTypes {
  KG = "kg",
  G = "g",
  L = "L",
  ML = "mL",
}

export enum ComplaintTypes {
  WARDEN = "warden",
  SECURITY = "security",
  MAINTENANCE = "maintenance",
  MESS = "mess",
  NOT_SELECTED = "not selected",
}

export enum ComplaintAttachmentTypes {
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
  NOT_SELECTED = "not selected",
}

export enum LoginType {
  WEB = "web",
  ANDORID = "android",
  IOS = "ios",
}

export enum TemplateTypes {
  //LINK: User
  PROFILE_UPDATED = "profile updated",
  USER_ROLE_UPDATED = "user role updated",
  PASSWORD_RESET = "password reset",

  //LINK: Leave
  LEAVE_REQUEST_SUBMITTED = "leave request submitted",
  LEAVE_APPROVED = "leave approved",
  LEAVE_REJECTED = "leave rejected",
  LEAVE_CANCELLED = "leave cancelled",

  //LINK: Meal
  MEAL_BOOKED = "meal booked",
  MEAL_CANCELLED = "meal cancelled",
  MEAL_AUTO_BOOKED = "meals autobooked",

  //LINK: Complaint
  COMPLAINT_SUBMITTED = "complaint submitted",
  COMPLAINT_RESOLVED = "complaint resolved",
  COMPLAINT_KEPT_ON_HOLD = "complaint kept on hold",
  COMPLAINT_ESCALATED_ASSIGNED = "complaint escalated assigned",
  COMPAINT_MARK_AS_LONG_TERM_WORK = "complaint marked as long term work",
  COMPLAINT_REJECTED = "complaint rejected",
  COMPLAINT_APPROVAL_PENDING = "complaint Approval pending",

  OTHER = "other",
}

export enum NoticeTypes {
  PUSH_NOTIFICATION = "push notification",
  SMS = "sms",
  EMAIL = "email",
}

export enum PushNotificationTypes {
  AUTO = "auto",
  MANUAL = "manual",
}

export enum QRPurpose {
  MESS_ATTENDANCE = "MESS_ATTENDANCE",
  LEAVE = "LEAVE",
  HOSTEL_ATTENDANCE = "HOSTEL_ATTENDANCE",
}

export enum AnnouncementStatus {
  UPCOMING = "UPCOMING",
  CURRENT = "CURRENT",
  PAST = "PAST",
}

export enum EventStatus {
  ACTIVE = "ACTIVE",
  CANCELLED = "CANCELLED",
}

export enum AttachmentType {
  FILE = "FILE",
  LINK = "LINK",
}
