import type { Brand } from "./config";

const SCRIPT_URL = process.env.APPS_SCRIPT_URL!;
const SCRIPT_SECRET = process.env.APPS_SCRIPT_SECRET!;

// Column order matches brand tab headers
export type SheetRow = {
  contentId: string;
  seqNo: string;
  name: string;
  creator: string;
  contentType: string;
  typeCode: string;
  description: string;
  date: string;
  layer: string;
  angles: string;
  ranking: string;
  isLive: string;
  fileName: string;
  fileUrl: string;
  createdAt: string;
  // Meta Ads metrics — filled after content goes live
  amountSpent: string;   // Amount Spent (RM)
  impressions: string;   // Impressions
  cpm: string;           // CPM (RM per 1,000 impressions)
  messagingStarted: string; // Messaging Conversations Started
  purchases: string;     // Purchases
  purchaseRoas: string;  // Purchase ROAS
};

// All calls go through GET to avoid POST-redirect body-loss issues
// with Apps Script Web Apps.
async function scriptCall(
  action: string,
  params: Record<string, string> = {},
  payload?: Record<string, unknown>,
) {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set("secret", SCRIPT_SECRET);
  url.searchParams.set("action", action);

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  if (payload) {
    url.searchParams.set("payload", JSON.stringify(payload));
  }

  const res = await fetch(url.toString(), { redirect: "follow" });
  const text = await res.text();

  try {
    const data = JSON.parse(text);
    if (data.error) throw new Error(data.error);
    return data;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(describeNonJson(res.status, res.url, text));
    }
    throw e;
  }
}

// Apps Script answered with something that isn't JSON — almost always an
// HTML page from Google. Say which one, so the cause is obvious.
export function describeNonJson(status: number, finalUrl: string, text: string): string {
  const title = (text.match(/<title>([^<]*)<\/title>/i)?.[1] || "").trim();
  const host = (() => {
    try {
      return new URL(finalUrl).host;
    } catch {
      return "";
    }
  })();

  let hint = "";
  if (host.includes("accounts.google.com") || /sign in|登录|登入/i.test(title)) {
    hint = "Google 要求登入 → Apps Script 部署的 Who has access 不是 Anyone";
  } else if (status === 404 || /not found|找不到/i.test(title)) {
    hint = "网址不存在 → APPS_SCRIPT_URL 填错了";
  } else if (/\/dev(\?|$)/.test(finalUrl)) {
    hint = "用了 /dev 测试网址 → 要用 /exec 结尾的";
  } else if (status === 414 || status === 400) {
    hint = "请求太长或格式不对";
  }

  const snippet = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return `Apps Script 没有回 JSON（HTTP ${status}${title ? `，页面标题「${title}」` : ""}）${hint ? " — " + hint : ""}${!title && snippet ? " — " + snippet : ""}`;
}

// Read all rows from a brand tab
export async function getRows(brand: Brand): Promise<SheetRow[]> {
  const data = await scriptCall("getRows", { brand });
  return data.rows;
}

// Read all rows from all brand tabs (for master view)
export async function getAllRows(): Promise<(SheetRow & { brand: string })[]> {
  const data = await scriptCall("getAllRows");
  return data.rows;
}

// Get next sequence number for a brand
export async function getNextSeqNo(brand: Brand): Promise<number> {
  const data = await scriptCall("getNextSeqNo", { brand });
  return data.seqNo;
}

// Append a new row to brand tab + Master tab
export async function appendRow(brand: Brand, row: SheetRow): Promise<void> {
  await scriptCall("appendRow", {}, { brand, row });
}

// Update a row by Content ID
export async function updateRow(
  brand: Brand,
  contentId: string,
  updates: Partial<SheetRow>,
): Promise<SheetRow | null> {
  const data = await scriptCall("updateRow", {}, { brand, contentId, updates });
  return data.row || null;
}

// Get a single row by Content ID
export async function getRowById(
  brand: Brand,
  contentId: string,
): Promise<SheetRow | null> {
  try {
    const data = await scriptCall("getRowById", { brand, contentId });
    return data.row || null;
  } catch {
    return null;
  }
}

// Read angles from Config tab
export async function getAnglesFromConfig(): Promise<Record<string, string[]>> {
  const data = await scriptCall("getAngles");
  return data.angles;
}

// ============================================================
// Tasks — stored in a "Tasks" tab in the same spreadsheet
// ============================================================

export type TaskRow = {
  taskId: string;
  brand: string;
  contentType: string;
  description: string;
  dueDate: string;
  assignee: string;
  status: string;
  createdBy: string;
  createdAt: string;
};

// Read all tasks
export async function getTasks(): Promise<TaskRow[]> {
  const data = await scriptCall("getTasks");
  return data.rows;
}

// Get next task ID number
export async function getNextTaskId(): Promise<number> {
  const data = await scriptCall("getNextTaskId");
  return data.nextId;
}

// Append a new task
export async function appendTask(row: TaskRow): Promise<void> {
  await scriptCall("appendTask", {}, { row });
}

// Update a task by taskId (status, description, etc.)
export async function updateTask(
  taskId: string,
  updates: Partial<TaskRow>,
): Promise<TaskRow | null> {
  const data = await scriptCall("updateTask", {}, { taskId, updates });
  return data.row || null;
}

// Delete a task by taskId
export async function deleteTask(taskId: string): Promise<boolean> {
  const data = await scriptCall("deleteTask", {}, { taskId });
  return data.success === true;
}

// ============================================================
// Meta daily — "MetaDaily" tab, one row per day x brand x content x currency
// ============================================================

export type DailyClear = { brands: string[]; since: string; until: string };

// Calls are GET with the payload in the URL, so rows go in small chunks.
// The first chunk carries `clear` (zero the window before writing).
export async function upsertMetaDaily(
  rows: (string | number)[][],
  clear: DailyClear,
): Promise<{ updated: number; appended: number }> {
  const CHUNK = 40;
  let updated = 0;
  let appended = 0;
  if (rows.length === 0) {
    await scriptCall("upsertMetaDaily", {}, { rows: [], clear });
    return { updated, appended };
  }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const data = await scriptCall("upsertMetaDaily", {}, {
      rows: rows.slice(i, i + CHUNK),
      clear: i === 0 ? clear : undefined,
    });
    updated += data.updated || 0;
    appended += data.appended || 0;
  }
  return { updated, appended };
}

export async function getMetaDaily(): Promise<unknown[][]> {
  const data = await scriptCall("getMetaDaily");
  return data.rows || [];
}

// "MetaAds" tab: [brand, contentId, firstAdDate, adCount] per content.
// Rows for the listed brands are replaced wholesale on each sync.
export async function replaceMetaAds(
  brands: string[],
  rows: (string | number)[][],
): Promise<void> {
  if (brands.length === 0) return;
  // Small payloads (one row per content), but still chunk-safe: the first
  // call clears the brands, later calls only append (brands: []).
  const CHUNK = 60;
  if (rows.length === 0) {
    await scriptCall("replaceMetaAds", {}, { brands, rows: [] });
    return;
  }
  for (let i = 0; i < rows.length; i += CHUNK) {
    await scriptCall("replaceMetaAds", {}, {
      brands: i === 0 ? brands : [],
      rows: rows.slice(i, i + CHUNK),
    });
  }
}

export async function getMetaAds(): Promise<unknown[][]> {
  const data = await scriptCall("getMetaAds");
  return data.rows || [];
}
