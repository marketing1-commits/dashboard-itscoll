/**
 * Content Dashboard — Google Apps Script Backend
 *
 * SETUP:
 * 1. Go to https://script.google.com and create a new project
 * 2. Paste this entire file into Code.gs
 * 3. Change API_SECRET below to a random string
 * 4. Click Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL into your .env as APPS_SCRIPT_URL
 * 6. Put the same API_SECRET into .env as APPS_SCRIPT_SECRET
 */

// ===== CONFIGURATION — EDIT THESE =====
var API_SECRET = "CHANGE_ME_TO_A_RANDOM_STRING";

var SPREADSHEET_ID = "1s0CQj_PvsIEznnMVKzw29dhy8LLZ3ZSG3DlkedP5DcE";

var DRIVE_FOLDERS = {
  Oxygrainz:    "1s6Y62SbY7TfRAte2LIucMLWPdyH70OP7",
  FlexiGlo:     "1cpxex1-AFr03u6BhvxNEoASE1VX6ABi4",
  Multigrainz:  "1tM84-56WD7hzgp8KaUDwUIt3jR4Hd1n7",
};

// ===== DO NOT EDIT BELOW =====

var BRANDS = ["Oxygrainz", "FlexiGlo", "Multigrainz"];

var HEADERS = [
  "contentId", "seqNo", "name", "creator", "contentType",
  "typeCode", "description", "date", "layer", "angles",
  "fileName", "fileUrl", "createdAt",
];

// Master tab has an extra "brand" column at the front
var MASTER_HEADERS = ["brand"].concat(HEADERS);

// This function is never called directly — it triggers Drive scope
// so that ScriptApp.getOAuthToken() includes Drive permissions.
function _initDriveScope() {
  DriveApp.getRootFolder();
}

// ===== WEB APP ENTRY POINTS =====

function doGet(e) {
  try {
    if (e.parameter.secret !== API_SECRET) {
      return _json({ error: "Unauthorized" });
    }

    var action = e.parameter.action || "";
    var payload = e.parameter.payload
      ? JSON.parse(decodeURIComponent(e.parameter.payload))
      : {};

    switch (action) {
      case "getRows":
        return _getRows(e.parameter.brand);
      case "getAllRows":
        return _getAllRows();
      case "getNextSeqNo":
        return _getNextSeqNo(e.parameter.brand);
      case "getAngles":
        return _getAngles();
      case "getRowById":
        return _getRowById(e.parameter.brand, e.parameter.contentId);
      case "appendRow":
        return _appendRow(payload);
      case "updateRow":
        return _updateRow(payload);
      case "createUploadUrl":
        return _createUploadUrl(payload);
      default:
        return _json({ error: "Unknown action: " + action });
    }
  } catch (err) {
    return _json({ error: String(err) });
  }
}

// doPost is also defined for flexibility, but the Next.js app uses doGet
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== API_SECRET) {
      return _json({ error: "Unauthorized" });
    }
    var action = body.action || "";
    switch (action) {
      case "appendRow":
        return _appendRow(body);
      case "updateRow":
        return _updateRow(body);
      case "createUploadUrl":
        return _createUploadUrl(body);
      default:
        return _json({ error: "Unknown action: " + action });
    }
  } catch (err) {
    return _json({ error: String(err) });
  }
}

// ===== HELPERS =====

function _json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function _getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function _rowToObj(values) {
  var obj = {};
  HEADERS.forEach(function (h, i) {
    obj[h] = String(values[i] != null ? values[i] : "");
  });
  return obj;
}

// ===== SHEET OPERATIONS =====

function _getRows(brand) {
  if (BRANDS.indexOf(brand) === -1) return _json({ error: "Invalid brand" });

  var sheet = _getSheet(brand);
  if (!sheet || sheet.getLastRow() < 2) return _json({ rows: [] });

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  var rows = [];
  data.forEach(function (r) {
    if (r[0]) rows.push(_rowToObj(r));
  });
  return _json({ rows: rows });
}

function _getAllRows() {
  var allRows = [];
  BRANDS.forEach(function (brand) {
    var sheet = _getSheet(brand);
    if (!sheet || sheet.getLastRow() < 2) return;
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
    data.forEach(function (r) {
      if (r[0]) {
        var obj = _rowToObj(r);
        obj.brand = brand;
        allRows.push(obj);
      }
    });
  });
  return _json({ rows: allRows });
}

function _getNextSeqNo(brand) {
  if (BRANDS.indexOf(brand) === -1) return _json({ error: "Invalid brand" });

  var sheet = _getSheet(brand);
  if (!sheet || sheet.getLastRow() < 2) return _json({ seqNo: 1 });

  var seqNos = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
  var max = 0;
  seqNos.forEach(function (r) {
    var n = parseInt(r[0], 10) || 0;
    if (n > max) max = n;
  });
  return _json({ seqNo: max + 1 });
}

function _appendRow(payload) {
  var brand = payload.brand;
  var row = payload.row;
  if (BRANDS.indexOf(brand) === -1) return _json({ error: "Invalid brand" });

  var values = HEADERS.map(function (h) { return row[h] || ""; });

  // Write to brand tab
  var brandSheet = _getSheet(brand);
  if (brandSheet) brandSheet.appendRow(values);

  // Write to Master tab (with brand column at front)
  var masterSheet = _getSheet("Master");
  if (masterSheet) masterSheet.appendRow([brand].concat(values));

  return _json({ success: true });
}

function _getAngles() {
  var sheet = _getSheet("Config");
  if (!sheet || sheet.getLastRow() < 2) return _json({ angles: {} });

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var angles = {};
  data.forEach(function (r) {
    var b = String(r[0] || "").trim();
    var a = String(r[1] || "").trim();
    if (!b || !a) return;
    if (!angles[b]) angles[b] = [];
    angles[b].push(a);
  });
  return _json({ angles: angles });
}

function _updateRow(payload) {
  var brand = payload.brand;
  var contentId = payload.contentId;
  var updates = payload.updates;
  if (BRANDS.indexOf(brand) === -1) return _json({ error: "Invalid brand" });

  var sheet = _getSheet(brand);
  if (!sheet || sheet.getLastRow() < 2) return _json({ error: "Not found" });

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  var idx = -1;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(contentId)) { idx = i; break; }
  }
  if (idx === -1) return _json({ error: "Not found" });

  var actualRow = idx + 2; // +1 header, +1 zero-index
  HEADERS.forEach(function (h, col) {
    if (updates[h] !== undefined) {
      sheet.getRange(actualRow, col + 1).setValue(updates[h]);
    }
  });

  // Read back the updated row
  var updatedValues = sheet.getRange(actualRow, 1, 1, HEADERS.length).getValues()[0];
  return _json({ success: true, row: _rowToObj(updatedValues) });
}

function _getRowById(brand, contentId) {
  if (BRANDS.indexOf(brand) === -1) return _json({ error: "Invalid brand" });

  var sheet = _getSheet(brand);
  if (!sheet || sheet.getLastRow() < 2) return _json({ error: "Not found" });

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(contentId)) {
      return _json({ row: _rowToObj(data[i]) });
    }
  }
  return _json({ error: "Not found" });
}

// ===== DRIVE UPLOAD =====

function _createUploadUrl(payload) {
  var brand = payload.brand;
  var fileName = payload.fileName;
  var mimeType = payload.mimeType;
  var folderId = DRIVE_FOLDERS[brand];

  if (!folderId) return _json({ error: "Invalid brand for upload" });

  var token = ScriptApp.getOAuthToken();

  var res = UrlFetchApp.fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "post",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        name: fileName,
        parents: [folderId],
      }),
      muteHttpExceptions: true,
    }
  );

  var headers = res.getHeaders();
  var uploadUrl = headers["Location"] || headers["location"];

  if (!uploadUrl) {
    return _json({
      error: "Upload init failed",
      detail: res.getContentText().substring(0, 300),
    });
  }

  return _json({ uploadUrl: uploadUrl });
}
