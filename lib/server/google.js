// Server-only bridge to the private Google Apps Script web app.
// GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_SECRET must never reach the browser.
export async function googleAction(action, payload={}) {
  const endpoint=process.env.GOOGLE_SCRIPT_URL;
  const secret=process.env.GOOGLE_SCRIPT_SECRET;
  if(!endpoint||!secret) throw Object.assign(new Error('The enquiry connection is being prepared. Please try again shortly.'),{status:503});
  const parsed=new URL(endpoint);
  if(parsed.protocol!=='https:'||parsed.hostname!=='script.google.com')throw new Error('Invalid Google connection');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,secret,...payload}),signal:AbortSignal.timeout(15000),redirect:'follow',cache:'no-store'});
  if(!response.ok)throw new Error('Google Sheets is temporarily unavailable');
  const result=await response.json();
  if(result.ok!==true)throw new Error(result.error||'Google Sheets did not confirm the request');
  return result;
}

// Framework-neutral result: route handlers turn this into a Response.
export const result=(status,body)=>({status,body});

export function toResponse({status,body},headers={}){
  return Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
}
