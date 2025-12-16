import slugify from "slugify";

export const toSlug = (value: string): string => {
  return slugify(value, {
    lower: true,
    trim: true,
    strict: true, // removes invalid chars
  });
};
