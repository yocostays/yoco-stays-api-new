import * as XLSX from "xlsx";

interface ExcelToJsonOptions {
  sheetName?: string; // Optional sheet name if you want to specify
  rawNumbers?: boolean; // Option to handle raw numbers
}

export const excelToJson = async (
  fileBuffer: Buffer,
  options: ExcelToJsonOptions = {}
): Promise<any[]> => {
  // Read the workbook from the buffer
  const workbook = XLSX.read(fileBuffer);

  // Take the provided sheetName or default to the first sheet
  const sheetName = options.sheetName || workbook.SheetNames[0];

  // Get the worksheet based on the chosen sheetName
  const worksheet = workbook.Sheets[sheetName];

  // If the sheet is not found (in case an invalid sheetName is provided)
  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" not found in the workbook.`);
  }

  // Convert the worksheet to JSON using the specified options (rawNumbers, etc.)
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    rawNumbers: options.rawNumbers ?? true, // Default to true for rawNumbers
  });

  return jsonData;
};
