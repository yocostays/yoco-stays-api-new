import { createObjectCsvStringifier } from "csv-writer";

// Function to create CSV string from data and headers
export const generateCsvString = (
  data: any[],
  headers: { id: string; title: string }[]
) => {
  const csvStringifier = createObjectCsvStringifier({
    header: headers,
  });

  return (
    csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(data)
  );
};
