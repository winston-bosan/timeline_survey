// Backend for index.html: a Google Apps Script web app that is attached to the sheet.
//
// Two tabs, and one rule for both: one row = one submission, and rows are never edited.
//   forecasts : the TAI curves. The script finds this tab by its header row (it has the columns "name" and "cdf").
//   answers   : the China questions. The script makes this tab, and it adds a column when a new question id arrives.
//
// GET  .../exec               -> {ok, tab:'forecasts', rows:[{header: value}]}
// GET  .../exec?tab=answers   -> {ok, tab:'answers',   rows:[...]}
// POST .../exec  (JSON body)  -> appends one row. body.tab selects the tab; body.hp is the honeypot field.

const ANSWERS = 'answers';
const KEY = /^[a-z][a-z0-9_]{0,30}$/; // a permitted column name in the answers tab
const MAX_COLS = 60;

function sheetFor(tab) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (tab === ANSWERS) return ss.getSheetByName(ANSWERS) || ss.insertSheet(ANSWERS, ss.getSheets().length);
  // The forecasts tab is the one whose header row has the columns "name" and "cdf". Its name and position do not matter.
  const hit = ss.getSheets().filter(function (sh) {
    const n = sh.getLastColumn();
    if (!n) return false;
    const head = sh.getRange(1, 1, 1, n).getValues()[0].map(String);
    return head.indexOf('name') >= 0 && head.indexOf('cdf') >= 0;
  })[0];
  if (!hit) throw new Error('no forecasts tab: no tab has a header row with "name" and "cdf"');
  return hit;
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const tab = e && e.parameter && e.parameter.tab === ANSWERS ? ANSWERS : 'forecasts';
    const v = sheetFor(tab).getDataRange().getValues();
    const head = v[0].map(String);
    const rows = v.slice(1).map(function (r) {
      const o = {};
      head.forEach(function (k, i) { if (k) o[k] = r[i]; });
      return o;
    });
    return out({ ok: true, tab: tab, rows: rows });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

// A cell holds a number or a text. Lists and objects go in as JSON text.
// Text that starts with = + - @ gets a leading apostrophe, so that Sheets does not run it as a formula.
function cell(v) {
  if (v == null) return '';
  if (typeof v === 'number') return isFinite(v) ? v : '';
  const s = (typeof v === 'string' ? v : JSON.stringify(v)).slice(0, 45000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.hp) return out({ ok: true }); // a bot filled the hidden field: accept and drop
    const tab = b.tab === ANSWERS ? ANSWERS : 'forecasts';
    delete b.hp;
    delete b.tab;
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sh = sheetFor(tab);
      const n = sh.getLastColumn();
      let head = n ? sh.getRange(1, 1, 1, n).getValues()[0].map(String) : [];
      const add = Object.keys(b).filter(function (k) { return head.indexOf(k) < 0; });
      if (add.length) {
        if (tab !== ANSWERS) throw new Error('unknown field: ' + add[0]);
        if (!add.every(function (k) { return KEY.test(k); }) || head.length + add.length > MAX_COLS) throw new Error('bad field name');
        sh.getRange(1, head.length + 1, 1, add.length).setValues([add]);
        head = head.concat(add);
      }
      if (tab === ANSWERS) {
        // Only short values belong in this tab: a name, an organization, a number.
        Object.keys(b).forEach(function (k) { if (String(b[k]).length > 200) throw new Error('value too long: ' + k); });
      }
      sh.appendRow(head.map(function (k) { return cell(b[k]); }));
    } finally {
      lock.releaseLock();
    }
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}
