import { readFile } from 'node:fs/promises';
import { googleAction, reply } from '../lib/google.js';

export function mergeInventory(base,rows){
  if(!Array.isArray(rows))throw Error('Invalid inventory');
  const seen=new Set();const allowed=new Map(base.units.map(u=>[u.unit,u]));
  const overrides=new Map();
  for(const row of rows){
    const id=String(row.unit).trim();if(!allowed.has(id)||seen.has(id))throw Error('Unknown or duplicate home');seen.add(id);
    const status=String(row.status).trim().toLowerCase();const price=Number(row.price);
    if(!['available','held','sold'].includes(status)||!Number.isFinite(price)||price<=0)throw Error('Invalid availability or price');
    overrides.set(id,{status,price});
  }
  if(overrides.size!==allowed.size)throw Error('Inventory is incomplete');
  return {...base,units:base.units.map(u=>({...u,...overrides.get(u.unit)})),source:'google-sheets',updated:new Date().toISOString()};
}

export default async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return reply(res,405,{error:'Method not allowed'});}
  const base=JSON.parse(await readFile(new URL('../data/inventory.json',import.meta.url),'utf8'));
  if(!process.env.GOOGLE_SCRIPT_URL)return reply(res,200,{...base,source:'sample'});
  try{const result=await googleAction('inventory');return reply(res,200,mergeInventory(base,result.units));}
  catch{console.error('Inventory refresh unavailable');return reply(res,503,{error:'Availability could not refresh. Please try again.'});}
}
