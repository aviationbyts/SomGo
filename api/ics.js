const dns=require('dns').promises;
const priv=ip=>/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1|fc|fd|fe80)/i.test(ip);
async function safe(u){if(u.protocol!=='https:')throw new Error('Alleen https-links');const a=await dns.lookup(u.hostname,{all:true});if(a.some(x=>priv(x.address)))throw new Error('Niet toegestaan')}
module.exports=async(req,res)=>{
 if(req.method!=='POST')return res.status(405).send('Alleen POST');
 let u;try{u=new URL(String((req.body||{}).url||'').trim().replace(/^webcal:/i,'https:'))}catch{return res.status(400).send('Ongeldige link')}
 try{let r;
  for(let i=0;i<4;i++){await safe(u);
   r=await fetch(u,{redirect:'manual',headers:{'User-Agent':'Mozilla/5.0 (compatible; SomGo/0.3)','Accept':'text/calendar,*/*'},signal:AbortSignal.timeout(8000)});
   if(r.status>=300&&r.status<400&&r.headers.get('location')){u=new URL(r.headers.get('location'),u);continue}break}
  if(!r.ok)return res.status(502).send('Somtoday gaf status '+r.status);
  const t=await r.text();if(t.length>3e6)return res.status(413).send('Bestand te groot');
  if(!t.includes('BEGIN:VCALENDAR'))return res.status(422).send('Antwoord was geen agenda-bestand');
  res.setHeader('Content-Type','text/calendar; charset=utf-8');res.setHeader('Cache-Control','no-store');res.send(t)}
 catch(e){res.status(502).send(e.message||'Ophalen mislukt')}};
