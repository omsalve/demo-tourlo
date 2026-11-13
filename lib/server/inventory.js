import { googleAction, result } from './google.js';

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

// base is public/data/inventory.json: unit specs come from the repo, status and price from the sheet.
export async function handleInventory(base){
  if(!process.env.GOOGLE_SCRIPT_URL)return result(200,{...base,source:'sample'});
  try{const sheet=await googleAction('inventory');return result(200,mergeInventory(base,sheet.units));}
  catch{console.error('Inventory refresh unavailable');return result(503,{error:'Availability could not refresh. Please try again.'});}
}
