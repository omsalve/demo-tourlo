import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {handleLead,validateLead} from '../lib/server/leads.js';
import {handleInventory,mergeInventory} from '../lib/server/inventory.js';
import {parseCommand} from '../lib/demo/voice.js';
const base=JSON.parse(await fs.readFile('public/data/inventory.json','utf8'));
const visitor={requestId:'fedcba98-7654-4321-aaaa-123456789abc',name:'Test Visitor',company:'Test Company',email:'test@example.com',phone:'9999999999',role:'Other'};

test('lead validation rejects invalid contact data and limits context',()=>{
 for(const patch of [{requestId:'invalid'},{email:'not-an-email'},{phone:'123'},{role:'Admin'},{name:'x'}])assert.throws(()=>validateLead({...visitor,...patch}));
 const valid=validateLead({...visitor,source:'forged',secret:'never-copy',activeSeconds:-1,savedHomes:['101','102','103','104']});
 assert.equal(valid.source,'tourlo-v2');assert.equal(valid.secret,undefined);assert.equal(valid.activeSeconds,0);assert.equal(valid.savedHomes.length,3);
});
test('lead endpoint rejects foreign origins and never reports success without configuration',async()=>{
 const oldUrl=process.env.GOOGLE_SCRIPT_URL,oldSecret=process.env.GOOGLE_SCRIPT_SECRET;delete process.env.GOOGLE_SCRIPT_URL;delete process.env.GOOGLE_SCRIPT_SECRET;
 try{let res=await handleLead({origin:'https://other.example',host:'tourlo.example',body:JSON.stringify(visitor)});assert.equal(res.status,403);
 res=await handleLead({origin:'https://tourlo.example',host:'tourlo.example',body:JSON.stringify(visitor)});assert.equal(res.status,503);assert.equal(res.body.ok,false);
 res=await handleLead({origin:null,host:'tourlo.example',body:'{not json'});assert.equal(res.status,400);
 res=await handleLead({origin:null,host:'tourlo.example',body:'x'.repeat(20000)});assert.equal(res.status,413);
 }finally{if(oldUrl)process.env.GOOGLE_SCRIPT_URL=oldUrl;if(oldSecret)process.env.GOOGLE_SCRIPT_SECRET=oldSecret;}
});
test('inventory updates status and price while preserving unit specifications',()=>{
 const rows=base.units.map(u=>({...u,bhk:99,status:'sold',price:u.price+100}));const merged=mergeInventory(base,rows);
 assert.equal(merged.units[0].status,'sold');assert.equal(merged.units[0].price,base.units[0].price+100);assert.equal(merged.units[0].bhk,base.units[0].bhk);assert.equal(merged.source,'google-sheets');
 for(const bad of [rows.slice(1),[...rows,rows[0]],rows.map((r,i)=>i? r:{...r,status:'unknown'}),rows.map((r,i)=>i?r:{...r,price:-1})])assert.throws(()=>mergeInventory(base,bad));
});
test('unconfigured inventory is explicitly identified as sample',async()=>{const old=process.env.GOOGLE_SCRIPT_URL;delete process.env.GOOGLE_SCRIPT_URL;try{const res=await handleInventory(base);assert.equal(res.status,200);assert.equal(res.body.source,'sample');assert.equal(res.body.units.length,70);}finally{if(old)process.env.GOOGLE_SCRIPT_URL=old;}});
test('voice commands include guide, shortlist, spoken floor numbers and unknown fallback',()=>{for(const [q,type] of [['start guided visit','guided'],['next step','next'],['save this home','save'],['compare homes','compare'],['floor twelve','floor'],['unrecognised command xyz','unknown']])assert.equal(parseCommand(q).type,type);assert.equal(parseCommand('floor twelve').floor,12);});
test('Sheets bridge rejects unauthenticated writes, deduplicates retries and escapes formulas',async()=>{
 const headers=['requestId','name','company','phone','email','role','status'];const rows=[headers];let flushes=0,locks=0;
 const sheet={getLastRow:()=>rows.length,getLastColumn:()=>headers.length,appendRow:r=>rows.push(r),getRange:(row,col)=>({getValues:()=>[headers],createTextFinder:id=>({matchEntireCell:()=>({findNext:()=>rows.slice(1).some(r=>r[0]===id)?{}:null})})})};
 const ctx=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='TOURLO_SECRET'?'test-secret':'sheet-id'})},LockService:{getScriptLock:()=>({waitLock:()=>locks++,releaseLock:()=>locks--})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>flushes++},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}});
 vm.runInContext(await fs.readFile('integrations/google-sheets/Code.gs','utf8'),ctx);
 const call=secret=>ctx.doPost({postData:{contents:JSON.stringify({secret,action:'lead',lead:{...visitor,name:'=IMPORTXML("bad")'}})}});
 assert.equal(call('wrong').ok,false);assert.equal(rows.length,1);assert.equal(call('test-secret').ok,true);assert.equal(rows.length,2);assert.ok(rows[1][1].startsWith("'="));assert.equal(rows[1][6],'New');assert.equal(call('test-secret').duplicate,true);assert.equal(rows.length,2);assert.equal(flushes,1);assert.equal(locks,0);
});
