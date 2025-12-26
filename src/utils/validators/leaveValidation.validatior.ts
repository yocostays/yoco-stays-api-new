import Joi from "joi";
import moment from "moment-timezone";

const TIMEZONE = "Asia/Kolkata"; // your timezone

export const leaveValidationSchema = Joi.object({
  _valid: Joi.object().required().messages({
    "any.required": "_valid is required",
  }),

  categoryId: Joi.string().required().messages({
    "string.empty": "Category is required",
    "any.required": "Category is required",
  }),

  minutes: Joi.number().required().messages({
    "any.required": "minutes is required",
  }),

  startDate: Joi.string()
    .required()
    .custom((value, helpers) => {
      const start = moment.parseZone(value).tz(TIMEZONE); // respects +05:30
      const now = moment().tz(TIMEZONE); // current time in TZ

      if (!start.isValid()) {
        return helpers.error("any.invalid");
      }

      if (start.isBefore(now)) {
        return helpers.error("date.min");
      }

      return value;
    })
    .messages({
      "any.invalid": "Start date must be a valid date",
      "date.min": "Start date and time cannot be in the past",
      "any.required": "Start date is required",
    }),

  endDate: Joi.string()
    .required()
    .custom((value, helpers) => {
      const start = moment.tz(helpers.state.ancestors[0].startDate, TIMEZONE);
      const end = moment.tz(value, TIMEZONE);

      if (!end.isValid()) {
        return helpers.error("any.invalid");
      }

      if (end.isBefore(start)) {
        return helpers.error("date.min");
      }

      return value;
    })
    .messages({
      "any.invalid": "End date must be a valid date",
      "date.min": "End date must be after start date",
      "any.required": "End date is required",
    }),

  days: Joi.number().integer().min(0).required().messages({
    "number.base": "Days must be a number",
    "number.min": "Days must be 0 or more",
    "any.required": "Days is required",
  }),

  hours: Joi.number().min(0).required().messages({
    "number.base": "Hours must be a number",
    "number.min": "Hours must be 0 or more",
    "any.required": "Hours is required",
  }),

  description: Joi.string().trim().required().messages({
    "string.empty": "Description is required",
    "any.required": "Description is required",
  }),
});
