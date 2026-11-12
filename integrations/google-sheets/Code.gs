/* Tourlo V2 bridge. Both spreadsheets remain private.
 * Set Script Properties: TOURLO_SECRET, LEADS_SHEET_ID, INVENTORY_SHEET_ID.
 * Deploy as a web app executing as the sheet owner. The website calls this only
 * through its server, with the shared secret in the request body.
 */
function doPost(e) {
  try {
    const input = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('TOURLO_SECRET');
    if (!secret || input.secret !== secret) return json_({ok:false,error:'Not authorized'});
    if (input.action === 'inventory') return inventory_(props);
    if (input.action === 'lead') return lead_(props,input.lead);
    return json_({ok:false,error:'Unknown action'});
  } catch (err) { return json_({ok:false,error:'Unable to complete this request'}); }
}

function inventory_(props) {
  const sheet = SpreadsheetApp.openById(props.getProperty('INVENTORY_SHEET_ID')).getSheetByName('Inventory');
  const rows = sheet.getDataRange().getValues();
  const header = rows.shift();
  const col = name => header.indexOf(name);
  if (['unit','status','price'].some(name=>col(name)<0)) throw new Error('Inventory columns missing');
  const units=rows.filter(r=>r[col('unit')]!=='').map(r=>({unit:String(r[col('unit')]),status:String(r[col('status')]).toLowerCase().trim(),price:Number(r[col('price')])}));
  return json_({ok:true,units:units});
}

function lead_(props,lead) {
  if(!lead || !/^[a-f0-9-]{36}$/i.test(lead.requestId||'')) throw new Error('Invalid request');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try {
    const sheet=SpreadsheetApp.openById(props.getProperty('LEADS_SHEET_ID')).getSheetByName('Enquiries');
    const count=sheet.getLastRow();
    if(count>1){const match=sheet.getRange(2,1,count-1,1).createTextFinder(lead.requestId).matchEntireCell(true).findNext();if(match)return json_({ok:true,duplicate:true});}
    const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    const safe=value=>{const s=Array.isArray(value)?value.join(', '):String(value??'');return /^[=+@\-\t\r]/.test(s)?"'"+s:s;};
    sheet.appendRow(headers.map(h=>h==='status'?'New':safe(lead[h])));
    SpreadsheetApp.flush();
    return json_({ok:true,requestId:lead.requestId});
  } finally { lock.releaseLock(); }
}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
