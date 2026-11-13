import { result } from './google.js';

export const MAX_LEAD_BYTES=16000;
const RESEND_ENDPOINT='https://api.resend.com/emails';
// onboarding@resend.dev only delivers to the Resend account owner's own address; set LEAD_EMAIL_FROM to a verified domain for production.
const DEFAULT_FROM='Tourlo Enquiries <onboarding@resend.dev>';
const NOT_READY='The enquiry connection is being prepared. Please try again shortly.';

export function validateLead(input){
  if(!input||typeof input!=='object')throw Error('Please enter your details.');
  const text=(key,max=160)=>String(input[key]??'').trim().slice(0,max);
  const data={requestId:text('requestId',64),name:text('name'),company:text('company'),phone:text('phone',30),email:text('email',254),role:text('role',30)};
  if(!/^[a-f0-9-]{36}$/i.test(data.requestId))throw Error('Please refresh and try again.');
  if(data.name.length<2||data.company.length<2)throw Error('Please enter your name and company.');
  const digits=data.phone.replace(/\D/g,'');if(digits.length<10||digits.length>15)throw Error('Please enter a valid phone number.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email))throw Error('Please enter a valid email.');
  if(!['Developer','Sales','CP','Other'].includes(data.role))throw Error('Please choose your role.');
  return {...data,project:'Tourlo Demo Residences',source:'tourlo-v2',submittedAt:new Date().toISOString(),trigger:text('trigger',40),lastFloor:Number(input.lastFloor)||'',lastUnit:text('lastUnit',20),roomsViewed:Array.isArray(input.roomsViewed)?input.roomsViewed.filter(x=>typeof x==='string').slice(0,30):[],savedHomes:Array.isArray(input.savedHomes)?input.savedHomes.filter(x=>/^\d{3,4}$/.test(x)).slice(0,3):[],activeSeconds:Math.min(86400,Math.max(0,Number(input.activeSeconds)||0)),journeyStep:Number.isInteger(input.journeyStep)?input.journeyStep:''};
}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const oneLine=s=>String(s).replace(/[\r\n]+/g,' ');
const duration=s=>{s=Math.round(s);return s<60?`${s}s`:`${Math.floor(s/60)}m ${s%60}s`;};
const ist=iso=>new Date(iso).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST';

export function leadEmail(lead){
  const rows=[
    ['Name',lead.name],['Company',lead.company],['Role',lead.role],['Phone',lead.phone],['Email',lead.email],
    ['Saved homes',lead.savedHomes.join(', ')],['Last home viewed',lead.lastUnit],['Last floor',lead.lastFloor],
    ['Rooms viewed',lead.roomsViewed.join(', ')],['Time exploring',duration(lead.activeSeconds)],
    ['Form shown because',lead.trigger],['Guided visit step',lead.journeyStep===''?'':lead.journeyStep+1],
    ['Submitted',ist(lead.submittedAt)],['Request ID',lead.requestId],
  ].filter(([,v])=>v!==''&&v!=null);
  const subject=oneLine(`New enquiry: ${lead.name}, ${lead.company} (${lead.role})`).slice(0,200);
  const html=`<div style="font-family:Arial,sans-serif;color:#1b1b1b;max-width:560px"><h2 style="font-weight:600;margin:0 0 4px">New enquiry from ${esc(lead.project)}</h2><p style="color:#666;margin:0 0 18px">Reply to this email to respond to ${esc(lead.name)} directly.</p><table cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px">${rows.map(([k,v])=>`<tr><td style="border-bottom:1px solid #eee;color:#666;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="border-bottom:1px solid #eee">${esc(v)}</td></tr>`).join('')}</table></div>`;
  const text=`New enquiry from ${lead.project}\n\n${rows.map(([k,v])=>`${k}: ${v}`).join('\n')}\n`;
  return {subject,html,text};
}

// Sends the enquiry through Resend. Returns {duplicate} or throws an Error with an HTTP status.
export async function sendLeadEmail(lead){
  const key=process.env.RESEND_API_KEY?.trim();
  const to=(process.env.LEAD_EMAIL_TO||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!key||!to.length)throw Object.assign(new Error(NOT_READY),{status:503});
  const from=process.env.LEAD_EMAIL_FROM?.trim()||DEFAULT_FROM;
  const response=await fetch(RESEND_ENDPOINT,{
    method:'POST',
    headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`tourlo-lead/${lead.requestId}`},
    body:JSON.stringify({from,to,reply_to:lead.email,...leadEmail(lead),tags:[{name:'source',value:'tourlo_v2'}]}),
    signal:AbortSignal.timeout(15000),cache:'no-store',
  });
  if(response.ok)return {duplicate:false};
  const error=await response.json().catch(()=>({}));
  // Same request ID already accepted by Resend (a retry after a lost response, with a newer timestamp): it was sent once, so confirm.
  if(response.status===409&&error.name==='invalid_idempotent_request')return {duplicate:true};
  throw Object.assign(new Error(`Resend ${response.status} ${error.name||''}`.trim()),{status:502,resendStatus:response.status});
}

// origin/host are request headers; body is the raw request text or an already parsed object.
export async function handleLead({origin,host,body}){
  if(origin){try{if(new URL(origin).host!==host)return result(403,{ok:false,error:'Please submit from the Tourlo website.'});}catch{return result(403,{ok:false,error:'Invalid request origin'});}}
  if(typeof body==='string'&&body.length>MAX_LEAD_BYTES)return result(413,{ok:false,error:'Request too large'});
  let payload;
  try{payload=validateLead(typeof body==='string'?JSON.parse(body):body);}catch(e){return result(400,{ok:false,error:e instanceof SyntaxError?'Please enter your details.':e.message});}
  try{const sent=await sendLeadEmail(payload);return result(200,{ok:true,requestId:payload.requestId,duplicate:sent.duplicate});}
  catch(e){
    // Never log visitor details, only the failure class.
    console.error('Lead email failed:',e.status===503?'not configured':e.message);
    return result(e.status||502,{ok:false,error:e.status===503?e.message:'Your details could not be sent. Please try again.'});
  }
}
