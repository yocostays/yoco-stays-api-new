// this function normalizes bed number strings by removing unwanted characters and trimming whitespace

//we can use this function for normalizing strings like bed numbers that may have non-breaking spaces or zero-width characters

export const normalizeBedNumber = (input: any): string => {
  if (input == null) return "";
  let s = String(input);

  s = s.replace(/\u00A0/g, " ");

  s = s.replace(/[\u200B-\u200F]/g, "");

  s = s.replace(/\s+/g, " ");

  return s.trim();
};
