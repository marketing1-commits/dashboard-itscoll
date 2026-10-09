import type { Brand } from "./config";
import { describeNonJson } from "./sheets";

const SCRIPT_URL = process.env.APPS_SCRIPT_URL!;
const SCRIPT_SECRET = process.env.APPS_SCRIPT_SECRET!;

// Create a resumable upload URL via Apps Script → Google Drive API.
// The browser then uploads the file directly to this URL.
export async function createResumableUpload(
  brand: Brand,
  fileName: string,
  mimeType: string,
  origin: string,
): Promise<{ uploadUrl: string }> {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set("secret", SCRIPT_SECRET);
  url.searchParams.set("action", "createUploadUrl");
  url.searchParams.set(
    "payload",
    JSON.stringify({ brand, fileName, mimeType, origin }),
  );

  const res = await fetch(url.toString(), { redirect: "follow" });
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(describeNonJson(res.status, res.url, text));
  }

  if (data.error) {
    throw new Error(data.error);
  }
  if (!data.uploadUrl) {
    throw new Error("No upload URL returned");
  }

  return { uploadUrl: data.uploadUrl };
}

// Pull the Drive file ID out of a share URL like
// https://drive.google.com/file/d/<id>/view
export function fileIdFromUrl(fileUrl: string): string | null {
  const m = fileUrl.match(/\/d\/([^/?#]+)/);
  return m ? m[1] : null;
}

// Rename a Drive file to the generated content name. The extension is
// preserved on the Apps Script side.
export async function renameDriveFile(
  fileId: string,
  newName: string,
): Promise<string | null> {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set("secret", SCRIPT_SECRET);
  url.searchParams.set("action", "renameFile");
  url.searchParams.set("payload", JSON.stringify({ fileId, newName }));

  const res = await fetch(url.toString(), { redirect: "follow" });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(describeNonJson(res.status, res.url, text));
  }

  if (data.error) throw new Error(data.error);
  return data.name || null;
}
