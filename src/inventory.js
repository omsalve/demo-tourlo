export async function fetchInventory(signal) {
  const response=await fetch('/api/inventory',{cache:'no-store',signal});
  if(!response.ok)throw new Error('Availability could not refresh');
  const data=await response.json();
  if(!Array.isArray(data.units)||!data.units.length)throw new Error('No inventory returned');
  return data;
}

export function watchInventory(onData,onError){
  let pending=false;
  const refresh=async()=>{
    if(pending||document.hidden)return;pending=true;
    try{onData(await fetchInventory(AbortSignal.timeout(12000)));}catch(e){onError?.(e);}finally{pending=false;}
  };
  refresh();
  const timer=setInterval(refresh,30000);
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener('online',refresh);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',refresh);};
}
