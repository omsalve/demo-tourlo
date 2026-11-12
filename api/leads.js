import { googleAction, reply } from '../lib/google.js';

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

export default async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(res,405,{ok:false,error:'Method not allowed'});}
  const origin=req.headers.origin;
  if(origin){try{if(new URL(origin).host!==req.headers.host)return reply(res,403,{ok:false,error:'Please submit from the Tourlo website.'});}catch{return reply(res,403,{ok:false,error:'Invalid request origin'});}}
  let payload;
  try{payload=validateLead(typeof req.body==='string'?JSON.parse(req.body):req.body);}catch(e){return reply(res,400,{ok:false,error:e.message});}
  try{const result=await googleAction('lead',{lead:payload});return reply(res,200,{ok:true,requestId:payload.requestId,duplicate:!!result.duplicate});}
  catch(e){console.error('Lead save failed:',e.status||502);return reply(res,e.status||502,{ok:false,error:e.status===503?e.message:'Your details could not be saved. Please try again.'});}
}
