/**
 * ============================================================
 * itsColl Content Dashboard — Apps Script bridge (COMPLETE FILE)
 * ============================================================
 *
 * This replaces your whole Code.gs. Delete everything that is in the
 * editor now and paste this in.
 *
 * ---- SETUP (fill in CONFIG below) --------------------------
 *
 * 1. API_SECRET must match APPS_SCRIPT_SECRET in Vercel's env vars.
 * 2. SPREADSHEET_ID — already filled in.
 * 3. BRAND_FOLDERS — paste the Drive folder ID for each brand.
 *    To get one: open the folder in Drive, the URL looks like
 *    drive.google.com/drive/folders/1AbC...XyZ  → the 1AbC...XyZ part.
 *
 * ---- SPREADSHEET REQUIREMENTS ------------------------------
 *
 * Columns are matched by HEADER NAME, not by position. So you can add
 * or reorder columns freely — just keep the header text exactly as
 * listed in CONTENT_HEADERS / TASK_HEADERS below.
 *
 * Each brand tab (Oxygrainz / FlexiGlo / Multigrainz) + the Master tab
 * need these 19 headers in row 1:
 *   Content ID | Seq No | Name | Creator | Content Type | Type Code |
 *   Description | Date | Layer | Angles | File Name | File URL |
 *   Created At | Ranking | Is Live | Amount Spent | Messaging Started |
 *   Purchases | Purchase ROAS
 * (Meta numbers synced from Facebook live in the MetaDaily tab, which is
 *  created automatically — no headers to add for it.)
 *
 * A "Tasks" tab needs these 9 headers in row 1:
 *   Task ID | Brand | Content Type | Description | Due Date |
 *   Assignee | Status | Created By | Created At
 *
 * ---- DEPLOY ------------------------------------------------
 *
 * Deploy > Manage deployments > pencil icon > Version: New version >
 * Deploy. Keep "Execute as: Me" and "Who has access: Anyone".
 * The URL does not change, so Vercel needs no update.
 *
 * Also: run `authorizeOnce` from the editor once (Run menu) and accept
 * the Drive permission prompt, otherwise uploads will fail.
 */

// ============================================================
// CONFIG
// ============================================================

var API_SECRET = 'PUT_THE_SAME_SECRET_AS_VERCEL_HERE';

var SPREADSHEET_ID = '1s0CQj_PvsIEznnMVKzw29dhy8LLZ3ZSG3DlkedP5DcE';

var BRAND_FOLDERS = {
  'Oxygrainz':   'PASTE_OXYGRAINZ_FOLDER_ID',
  'FlexiGlo':    'PASTE_FLEXIGLO_FOLDER_ID',
  'Multigrainz': 'PASTE_MULTIGRAINZ_FOLDER_ID'
};

var MASTER_TAB = 'Master';
var TASKS_TAB = 'Tasks';
var CONFIG_TAB = 'Config';
var DAILY_TAB = 'MetaDaily';   // created automatically on first sync
var ADS_TAB = 'MetaAds';       // created automatically on first sync

// field key -> header text in row 1
var CONTENT_HEADERS = {
  contentId:        'Content ID',
  seqNo:            'Seq No',
  name:             'Name',
  creator:          'Creator',
  contentType:      'Content Type',
  typeCode:         'Type Code',
  description:      'Description',
  date:             'Date',
  layer:            'Layer',
  angles:           'Angles',
  fileName:         'File Name',
  fileUrl:          'File URL',
  createdAt:        'Created At',
  ranking:          'Ranking',
  isLive:           'Is Live',
  amountSpent:      'Amount Spent',
  impressions:      'Impressions',
  cpm:              'CPM',
  messagingStarted: 'Messaging Started',
  purchases:        'Purchases',
  purchaseRoas:     'Purchase ROAS'
};

var TASK_HEADERS = {
  taskId:      'Task ID',
  brand:       'Brand',
  contentType: 'Content Type',
  description: 'Description',
  dueDate:     'Due Date',
  assignee:    'Assignee',
  status:      'Status',
  createdBy:   'Created By',
  createdAt:   'Created At'
};

// ============================================================
// ROUTER
// ============================================================

function doGet(e) {
  try {
    var p = e.parameter || {};

    if (p.secret !== API_SECRET) {
      return json({ error: 'Unauthorized' });
    }

    var action = p.action;
    var payload = {};
    if (p.payload) {
      payload = JSON.parse(p.payload);
    }

    // --- content ---
    if (action === 'getRows')      return json({ rows: getRows_(p.brand) });
    if (action === 'getAllRows')   return json({ rows: getAllRows_() });
    if (action === 'getNextSeqNo') return json({ seqNo: getNextSeqNo_(p.brand) });
    if (action === 'appendRow')    return json(appendRow_(payload.brand, payload.row));
    if (action === 'updateRow')    return json({ row: updateRow_(payload.brand, payload.contentId, payload.updates) });
    // --- meta daily ---
    if (action === 'upsertMetaDaily') return json(upsertMetaDaily_(payload.rows, payload.clear));
    if (action === 'getMetaDaily')    return json({ rows: getMetaDaily_() });
    if (action === 'replaceMetaAds')  return json(replaceMetaAds_(payload.brands, payload.rows));
    if (action === 'getMetaAds')      return json({ rows: getMetaAds_() });
    if (action === 'getRowById')   return json({ row: getRowById_(p.brand, p.contentId) });
    if (action === 'getAngles')    return json({ angles: getAngles_() });

    // --- tasks ---
    if (action === 'getTasks')      return json({ rows: getTasks_() });
    if (action === 'getNextTaskId') return json({ nextId: getNextTaskId_() });
    if (action === 'appendTask')    return json(appendTask_(payload.row));
    if (action === 'updateTask')    return json({ row: updateTask_(payload.taskId, payload.updates) });
    if (action === 'deleteTask')    return json({ success: deleteTask_(payload.taskId) });

    // --- drive ---
    if (action === 'createUploadUrl') return json(createUploadUrl_(payload.brand, payload.fileName, payload.mimeType, payload.origin));
    if (action === 'renameFile')      return json(renameFile_(payload.fileId, payload.newName));

    return json({ error: 'Unknown action: ' + action });
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run this once from the editor to grant Drive + Sheets permissions. */
function authorizeOnce() {
  SpreadsheetApp.openById(SPREADSHEET_ID).getName();
  DriveApp.getRootFolder().getName();
  ScriptApp.getOAuthToken();
  Logger.log('Authorized.');
}

// ============================================================
// SHEET HELPERS — everything is matched by header name
// ============================================================

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" not found in the spreadsheet.');
  return sh;
}

/**
 * Build { fieldKey: columnIndex } by reading row 1 and matching it
 * against the given header map. Missing headers are simply absent,
 * so an un-migrated tab still works for the columns it does have.
 */
function colMap_(sh, headerMap) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) throw new Error('Tab "' + sh.getName() + '" has no header row.');

  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var byText = {};
  for (var c = 0; c < headers.length; c++) {
    byText[String(headers[c]).trim().toLowerCase()] = c + 1;
  }

  var map = {};
  for (var key in headerMap) {
    var col = byText[String(headerMap[key]).trim().toLowerCase()];
    if (col) map[key] = col;
  }
  return map;
}

/** Dates arrive as Date objects — the app wants plain strings. */
function cell_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v);
}

/** Read every data row of a tab as objects keyed by field name. */
function readTab_(sh, headerMap) {
  var map = colMap_(sh, headerMap);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];

  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = [];

  for (var i = 0; i < values.length; i++) {
    var obj = {};
    var any = false;
    for (var key in headerMap) {
      var col = map[key];
      var v = col ? cell_(values[i][col - 1]) : '';
      obj[key] = v;
      if (v !== '') any = true;
    }
    if (any) out.push(obj); // skip fully blank rows
  }
  return out;
}

/** Append one object to a tab, placing each field under its header. */
function appendToTab_(sh, headerMap, row) {
  var map = colMap_(sh, headerMap);
  var lastCol = sh.getLastColumn();
  var line = new Array(lastCol).fill('');

  for (var key in headerMap) {
    var col = map[key];
    if (col && row[key] !== undefined && row[key] !== null) {
      line[col - 1] = row[key];
    }
  }

  sh.appendRow(line);
}

/** Row number where `field` equals `value`, or -1. */
function findRow_(sh, headerMap, field, value) {
  var map = colMap_(sh, headerMap);
  var col = map[field];
  if (!col) throw new Error('Column for "' + field + '" not found in tab "' + sh.getName() + '".');

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;

  var ids = sh.getRange(2, col, lastRow - 1, 1).getValues();
  var target = String(value).trim();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === target) return i + 2;
  }
  return -1;
}

/** Patch only the fields present in `updates`. Returns the row, or null. */
function patchRow_(sh, headerMap, keyField, keyValue, updates) {
  var r = findRow_(sh, headerMap, keyField, keyValue);
  if (r === -1) return null;

  var map = colMap_(sh, headerMap);

  for (var key in updates) {
    var col = map[key];
    if (col) {
      sh.getRange(r, col).setValue(updates[key]);
    }
  }

  var lastCol = sh.getLastColumn();
  var values = sh.getRange(r, 1, 1, lastCol).getValues()[0];
  var out = {};
  for (var k in headerMap) {
    var c = map[k];
    out[k] = c ? cell_(values[c - 1]) : '';
  }
  return out;
}

// ============================================================
// CONTENT
// ============================================================

function assertBrand_(brand) {
  if (!brand || !BRAND_FOLDERS.hasOwnProperty(brand)) {
    throw new Error('Unknown brand: ' + brand);
  }
  return brand;
}

function getRows_(brand) {
  assertBrand_(brand);
  return readTab_(sheet_(brand), CONTENT_HEADERS);
}

function getAllRows_() {
  var out = [];
  for (var brand in BRAND_FOLDERS) {
    var sh = ss_().getSheetByName(brand);
    if (!sh) continue;
    var rows = readTab_(sh, CONTENT_HEADERS);
    for (var i = 0; i < rows.length; i++) {
      rows[i].brand = brand;
      out.push(rows[i]);
    }
  }
  return out;
}

function getNextSeqNo_(brand) {
  assertBrand_(brand);
  var rows = readTab_(sheet_(brand), CONTENT_HEADERS);
  var max = 0;
  for (var i = 0; i < rows.length; i++) {
    var n = parseInt(rows[i].seqNo, 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function appendRow_(brand, row) {
  assertBrand_(brand);
  if (!row) throw new Error('appendRow: missing row');

  appendToTab_(sheet_(brand), CONTENT_HEADERS, row);

  // Master tab gets the same row plus a Brand column, if that tab exists
  var master = ss_().getSheetByName(MASTER_TAB);
  if (master) {
    var masterHeaders = {};
    for (var k in CONTENT_HEADERS) masterHeaders[k] = CONTENT_HEADERS[k];
    masterHeaders.brand = 'Brand';

    var withBrand = {};
    for (var k2 in row) withBrand[k2] = row[k2];
    withBrand.brand = brand;

    appendToTab_(master, masterHeaders, withBrand);
  }

  return { success: true, row: row };
}

function updateRow_(brand, contentId, updates) {
  assertBrand_(brand);
  var result = patchRow_(sheet_(brand), CONTENT_HEADERS, 'contentId', contentId, updates || {});

  // keep Master in sync, best-effort
  var master = ss_().getSheetByName(MASTER_TAB);
  if (master) {
    try {
      patchRow_(master, CONTENT_HEADERS, 'contentId', contentId, updates || {});
    } catch (err) {
      // Master out of step shouldn't fail the write to the brand tab
    }
  }

  return result;
}

function getRowById_(brand, contentId) {
  assertBrand_(brand);
  var rows = readTab_(sheet_(brand), CONTENT_HEADERS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].contentId).trim() === String(contentId).trim()) return rows[i];
  }
  return null;
}

/**
 * Angles from the Config tab. Two layouts are understood:
 *
 *   A) Two columns, one angle per row (what the sheet uses):
 *        Brand      | Angle
 *        Oxygrainz  | 白发
 *        Oxygrainz  | 脱发
 *        FlexiGlo   | 膝盖痛｜咔咔响
 *
 *   B) One column per brand, brand name in row 1, angles below.
 *
 * Returns { brand: [angles...] }; {} if the tab is absent or empty.
 */
function getAngles_() {
  var sh = ss_().getSheetByName(CONFIG_TAB);
  if (!sh) return {};

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return {};

  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var header = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var out = {};

  var brandCol = header.indexOf('brand');
  var angleCol = header.indexOf('angle');
  if (angleCol === -1) angleCol = header.indexOf('angles');

  if (brandCol !== -1 && angleCol !== -1) {
    // Layout A
    for (var r = 1; r < lastRow; r++) {
      var b = String(values[r][brandCol]).trim();
      var a = String(values[r][angleCol]).trim();
      if (!b || !a) continue;
      if (!out[b]) out[b] = [];
      if (out[b].indexOf(a) === -1) out[b].push(a);
    }
    return out;
  }

  // Layout B
  for (var c = 0; c < lastCol; c++) {
    var brand = String(values[0][c]).trim();
    if (!brand) continue;
    var list = [];
    for (var r2 = 1; r2 < lastRow; r2++) {
      var v = String(values[r2][c]).trim();
      if (v) list.push(v);
    }
    if (list.length) out[brand] = list;
  }
  return out;
}

// ============================================================
// TASKS
// ============================================================

function getTasks_() {
  return readTab_(sheet_(TASKS_TAB), TASK_HEADERS);
}

function getNextTaskId_() {
  var rows = getTasks_();
  var max = 0;
  for (var i = 0; i < rows.length; i++) {
    var m = String(rows[i].taskId).match(/(\d+)\s*$/);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

function appendTask_(row) {
  if (!row || !row.taskId) throw new Error('appendTask: missing row.taskId');
  appendToTab_(sheet_(TASKS_TAB), TASK_HEADERS, row);
  return { success: true, row: row };
}

function updateTask_(taskId, updates) {
  return patchRow_(sheet_(TASKS_TAB), TASK_HEADERS, 'taskId', taskId, updates || {});
}

function deleteTask_(taskId) {
  var sh = sheet_(TASKS_TAB);
  var r = findRow_(sh, TASK_HEADERS, 'taskId', taskId);
  if (r === -1) return false;
  sh.deleteRow(r);
  return true;
}

// ============================================================
// META DAILY — one row per day x brand x content x currency
// ============================================================

var DAILY_HEADERS = ['Date', 'Brand', 'Content ID', 'Currency', 'Spend',
                     'Impressions', 'Messaging', 'Purchases', 'Purchase Value'];

function dailySheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(DAILY_TAB);
  if (!sh) {
    sh = ss.insertSheet(DAILY_TAB);
    sh.getRange(1, 1, 1, DAILY_HEADERS.length).setValues([DAILY_HEADERS]);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@'); // keep dates as plain text
  }
  return sh;
}

function dailyKey_(r) {
  return cell_(r[0]) + '|' + r[1] + '|' + r[2] + '|' + r[3];
}

/**
 * Insert or overwrite daily rows (arrays in DAILY_HEADERS order).
 *
 * `clear` = { brands: [...], since: 'yyyy-MM-dd', until: 'yyyy-MM-dd' }
 * is sent with the first chunk of a sync: existing rows for those brands
 * inside that window are zeroed first, so an ad that was renamed or
 * stopped matching doesn't leave old numbers behind.
 */
function upsertMetaDaily_(rows, clear) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = dailySheet_();
    var width = DAILY_HEADERS.length;
    var last = sh.getLastRow();
    var data = last >= 2 ? sh.getRange(2, 1, last - 1, width).getValues() : [];

    if (clear && clear.brands && clear.brands.length) {
      var changed = false;
      for (var i = 0; i < data.length; i++) {
        var d = cell_(data[i][0]);
        if (clear.brands.indexOf(String(data[i][1])) !== -1 &&
            d >= clear.since && d <= clear.until) {
          for (var c = 4; c < width; c++) data[i][c] = 0;
          changed = true;
        }
      }
      if (changed) sh.getRange(2, 1, data.length, width).setValues(data);
    }

    var index = {};
    for (var j = 0; j < data.length; j++) index[dailyKey_(data[j])] = j + 2;

    var appends = [];
    var updated = 0;
    for (var k = 0; k < (rows || []).length; k++) {
      var r = rows[k];
      var at = index[dailyKey_(r)];
      if (at) {
        sh.getRange(at, 1, 1, width).setValues([r]);
        updated++;
      } else {
        appends.push(r);
      }
    }
    if (appends.length) {
      sh.getRange(sh.getLastRow() + 1, 1, appends.length, width).setValues(appends);
    }
    return { updated: updated, appended: appends.length };
  } finally {
    lock.releaseLock();
  }
}

/** All daily rows as arrays; rows with no numbers at all are skipped. */
function getMetaDaily_() {
  var sh = ss_().getSheetByName(DAILY_TAB);
  if (!sh || sh.getLastRow() < 2) return [];
  var width = DAILY_HEADERS.length;
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var any = false;
    for (var c = 4; c < width; c++) if (Number(r[c])) any = true;
    if (!any) continue;
    r[0] = cell_(r[0]);
    out.push(r);
  }
  return out;
}

// ============================================================
// META ADS — per content: the date its first ad was created
// (covers ads that never spent, which MetaDaily can't see)
// ============================================================

var ADS_HEADERS = ['Brand', 'Content ID', 'First Ad Date', 'Ads'];

function adsSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(ADS_TAB);
  if (!sh) {
    sh = ss.insertSheet(ADS_TAB);
    sh.getRange(1, 1, 1, ADS_HEADERS.length).setValues([ADS_HEADERS]);
    sh.setFrozenRows(1);
    sh.getRange('C:C').setNumberFormat('@');
  }
  return sh;
}

/** Replace all rows of the given brands with `rows` (arrays in ADS_HEADERS order). */
function replaceMetaAds_(brands, rows) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = adsSheet_();
    var width = ADS_HEADERS.length;
    var last = sh.getLastRow();
    var keep = [];
    if (last >= 2) {
      var data = sh.getRange(2, 1, last - 1, width).getValues();
      for (var i = 0; i < data.length; i++) {
        if (data[i][0] && (brands || []).indexOf(String(data[i][0])) === -1) keep.push(data[i]);
      }
      sh.getRange(2, 1, last - 1, width).clearContent();
    }
    var all = keep.concat(rows || []);
    if (all.length) sh.getRange(2, 1, all.length, width).setValues(all);
    return { rows: all.length };
  } finally {
    lock.releaseLock();
  }
}

function getMetaAds_() {
  var sh = ss_().getSheetByName(ADS_TAB);
  if (!sh || sh.getLastRow() < 2) return [];
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, ADS_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    if (!data[i][0]) continue;
    data[i][2] = cell_(data[i][2]);
    out.push(data[i]);
  }
  return out;
}

// ============================================================
// DRIVE
// ============================================================

function brandFolder_(brand) {
  assertBrand_(brand);
  var id = BRAND_FOLDERS[brand];
  if (!id || id.indexOf('PASTE_') === 0) {
    throw new Error('Drive folder ID for ' + brand + ' is not set in CONFIG.');
  }
  return DriveApp.getFolderById(id);
}

/**
 * Start a resumable upload straight into the brand's Drive folder and
 * hand the session URL back. The browser PUTs the file bytes to it, so
 * the file never passes through Vercel — no 4.5MB body limit, and big
 * videos work.
 */
function createUploadUrl_(brand, fileName, mimeType, origin) {
  var folder = brandFolder_(brand);

  var headers = {
    Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
    'X-Upload-Content-Type': mimeType
  };
  // Without this, Drive blocks the browser's PUT to the session URL (CORS),
  // because the session was opened from Google's servers, not the dashboard.
  if (origin) headers.Origin = origin;

  var metadata = {
    name: fileName,
    mimeType: mimeType,
    parents: [folder.getId()]
  };

  var res = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(metadata),
      muteHttpExceptions: true
    }
  );

  if (res.getResponseCode() >= 300) {
    throw new Error('Drive rejected the upload session: ' + res.getContentText());
  }

  var uploadUrl = res.getAllHeaders()['Location'] || res.getAllHeaders()['location'];
  if (!uploadUrl) throw new Error('Drive did not return an upload URL.');

  return { uploadUrl: uploadUrl };
}

/**
 * Rename an uploaded file to the generated content name, keeping its
 * original extension. Called right after the sheet row is created,
 * because the name needs the sequence number.
 */
function renameFile_(fileId, newName) {
  if (!fileId) throw new Error('renameFile: missing fileId');
  if (!newName) throw new Error('renameFile: missing newName');

  var file = DriveApp.getFileById(fileId);
  var old = file.getName();

  // keep the extension off the original upload
  var ext = '';
  var dot = old.lastIndexOf('.');
  if (dot > 0) ext = old.substring(dot);

  var finalName = newName + ext;
  file.setName(finalName);

  return { success: true, name: finalName };
}
