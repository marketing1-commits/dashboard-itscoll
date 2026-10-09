import { CONTENT_TYPES, ContentType } from "./config";

/**
 * Generate auto content name
 * Format: {Creator} -{TypeCode} {SeqNo}- {Description} - {DDMMYY}
 * Example: Kayson -VI 364- 中医师IP（备孕）- 011026
 */
export function generateContentName(params: {
  creator: string;
  contentType: ContentType;
  seqNo: number;
  description: string;
  date: Date;
}): string {
  const typeCode = CONTENT_TYPES[params.contentType];
  const dd = String(params.date.getDate()).padStart(2, "0");
  const mm = String(params.date.getMonth() + 1).padStart(2, "0");
  const yy = String(params.date.getFullYear()).slice(-2);
  const dateStr = `${dd}${mm}${yy}`;

  return `${params.creator} -${typeCode} ${params.seqNo}- ${params.description} - ${dateStr}`;
}

/**
 * Format date for display (DD/MM/YYYY)
 */
export function formatDate(date: Date): string {
  // ISO (yyyy-MM-dd) on purpose: Google Sheets reads "01/10/2026" by the
  // spreadsheet's locale, so it can land as 10 Jan instead of 1 Oct.
  // ISO is unambiguous in every locale, and the app's parsers accept it.
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}
