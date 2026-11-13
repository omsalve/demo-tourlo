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
function withEnv(vars,fn){return async()=>{const saved={};for(const k of Object.keys(vars)){saved[k]=process.env[k];if(vars[k]==null)delete process.env[k];else process.env[k]=vars[k];}
 try{await fn();}finally{for(const [k,v] of Object.entries(saved)){if(v==null)delete process.env[k];else process.env[k]=v;}}};}
function mockFetch(responder){const calls=[];const real=globalThis.fetch;globalThis.fetch=async(url,init)=>{calls.push({url,init,body:JSON.parse(init.body)});return responder(calls.length);};return {calls,restore:()=>{globalThis.fetch=real;}};}
const resendEnv={RESEND_API_KEY:'re_test_key',LEAD_EMAIL_TO:'sales@example.com, team@example.com',LEAD_EMAIL_FROM:'Tourlo <leads@example.com>'};
const post=(extra={})=>handleLead({origin:'https://tourlo.example',host:'tourlo.example',body:JSON.stringify({...visitor,...extra})});

test('lead endpoint rejects foreign origins and never reports success without configuration',withEnv({RESEND_API_KEY:null,LEAD_EMAIL_TO:null},async()=>{
 let res=await handleLead({origin:'https://other.example',host:'tourlo.example',body:JSON.stringify(visitor)});assert.equal(res.status,403);
 res=await post();assert.equal(res.status,503);assert.equal(res.body.ok,false);
 res=await handleLead({origin:null,host:'tourlo.example',body:'{not json'});assert.equal(res.status,400);
 res=await handleLead({origin:null,host:'tourlo.example',body:'x'.repeat(20000)});assert.equal(res.status,413);
}));
test('lead is emailed through Resend with reply-to, idempotency key and escaped content',withEnv(resendEnv,async()=>{
 const m=mockFetch(()=>Response.json({id:'email_1'}));
 try{const res=await post({name:'<b>Test</b> Visitor',savedHomes:['101'],activeSeconds:125});assert.equal(res.status,200);assert.equal(res.body.ok,true);assert.equal(res.body.duplicate,false);
  const [c]=m.calls;assert.equal(c.url,'https://api.resend.com/emails');assert.equal(c.init.headers.Authorization,'Bearer re_test_key');assert.equal(c.init.headers['Idempotency-Key'],'tourlo-lead/'+visitor.requestId);
  assert.deepEqual(c.body.to,['sales@example.com','team@example.com']);assert.equal(c.body.from,'Tourlo <leads@example.com>');assert.equal(c.body.reply_to,'test@example.com');
  assert.ok(c.body.html.includes('&lt;b&gt;Test&lt;/b&gt;'));assert.ok(!c.body.html.includes('<b>Test'));assert.ok(c.body.text.includes('Saved homes: 101'));assert.ok(c.body.text.includes('Time exploring: 2m 5s'));assert.ok(!c.body.subject.includes('\n')&&!c.body.subject.includes('\r'));
 }finally{m.restore();}
}));
test('a retry Resend already accepted is confirmed once; provider failures never unlock',withEnv(resendEnv,async()=>{
 let m=mockFetch(()=>Response.json({name:'invalid_idempotent_request',message:'used'},{status:409}));
 try{const res=await post();assert.equal(res.status,200);assert.equal(res.body.duplicate,true);}finally{m.restore();}
 for(const failure of [()=>Response.json({name:'concurrent_idempotent_requests'},{status:409}),()=>Response.json({name:'rate_limit_exceeded'},{status:429}),()=>Response.json({name:'invalid_api_Key'},{status:403}),()=>{throw new TypeError('fetch failed');}]){
  m=mockFetch(failure);try{const res=await post();assert.equal(res.status,502);assert.equal(res.body.ok,false);assert.ok(!JSON.stringify(res.body).includes('re_test_key'));}finally{m.restore();}
 }
}));
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
