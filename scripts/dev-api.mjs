import http from 'node:http';
import leads from '../api/leads.js';
import inventory from '../api/inventory.js';
http.createServer(async(req,res)=>{
  res.status=code=>{res.statusCode=code;return res;};res.json=data=>res.end(JSON.stringify(data));
  let body='';for await(const chunk of req){body+=chunk;if(body.length>16000){res.status(413).json({error:'Request too large'});return;}}
  try{req.body=body?JSON.parse(body):null;await(req.url==='/api/leads'?leads:inventory)(req,res);}catch{res.status(500).json({error:'Request failed'});}
}).listen(4174,'127.0.0.1',()=>console.log('Tourlo API listening on 4174'));
