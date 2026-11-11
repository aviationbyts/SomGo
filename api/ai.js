const cut=(s,n)=>String(s||'').slice(0,n);
const models=()=>[process.env.GEMINI_MODEL,'gemini-3.5-flash','gemini-3.5-flash-lite','gemini-2.5-flash'].filter((m,i,a)=>m&&a.indexOf(m)===i);
async function gem(key,payload){let last='',busy=false;
 for(const m of models()){try{
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});
  const j=await r.json().catch(()=>({}));
  if(r.ok){const p=(((j.candidates||[])[0]||{}).content||{}).parts||[],t=p.map(x=>x.text||'').join('');if(t)return t;last='leeg';continue}
  last=r.status;if(r.status===429)busy=true}catch(e){last='net'}}
 const e=new Error(busy?'De AI is druk. Probeer het over een minuut opnieuw.':'De AI is niet beschikbaar ('+last+').');e.busy=busy;throw e}
module.exports=async(req,res)=>{
 if(req.method!=='POST')return res.status(405).json({error:'Alleen POST'});
 const key=process.env.GEMINI_API_KEY,su=process.env.SUPABASE_URL,sk=process.env.SUPABASE_KEY,lim=+process.env.AI_DAILY_LIMIT||30;
 if(!key||!su||!sk)return res.status(500).json({error:'AI is nog niet ingesteld op de server.'});
 let n;try{const r=await fetch(su+'/rest/v1/rpc/ai_hit',{method:'POST',headers:{apikey:sk,Authorization:req.headers.authorization||'','Content-Type':'application/json'},body:'{}'});
  if(r.status===401||r.status===403)return res.status(401).json({error:'Log opnieuw in.'});if(!r.ok)return res.status(500).json({error:'Controle mislukt.'});n=await r.json()}catch(e){return res.status(500).json({error:'Controle mislukt.'})}
 if(n>lim)return res.status(429).json({error:'Je daglimiet voor AI is bereikt. Probeer het morgen weer.'});
 const b=req.body||{};
 try{
  if(b.mode==='cards'){const q=cut(b.text,8000);if(q.length<3)return res.status(400).json({error:'Geen tekst.'});const k=Math.min(25,Math.max(3,+b.n||10));
   const prompt=`Maak ${k} flashcards (kort begrip of vraag, kort antwoord) in het Nederlands voor ${cut(b.level,40)||'de middelbare school'}${b.vak?', vak '+cut(b.vak,40):''}, over dit onderwerp of deze tekst:\n"""${q}"""\nAntwoord alleen met JSON in dit formaat: {"cards":[{"q":"...","a":"..."}]}`;
   const t=await gem(key,{contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:4096,temperature:.4}});
   let j;try{j=JSON.parse(t.replace(/^```(?:json)?|```$/g,'').trim())}catch(e){return res.status(502).json({error:'De AI gaf een onleesbaar antwoord. Probeer het opnieuw.'})}
   const cards=(Array.isArray(j)?j:j.cards||[]).filter(c=>c&&c.q&&c.a).slice(0,25).map(c=>({q:cut(c.q,200),a:cut(c.a,300)}));
   if(!cards.length)return res.status(502).json({error:'Geen kaarten gemaakt. Probeer het opnieuw.'});return res.json({cards})}
  if(b.mode==='chat'){let m=(Array.isArray(b.messages)?b.messages:[]).slice(-12);while(m.length&&m[0].r!=='user')m.shift();if(!m.length)return res.status(400).json({error:'Geen bericht.'});
   const sys='Je bent de SomGo-coach, een vriendelijke studiecoach voor Nederlandse middelbare scholieren. Antwoord in het Nederlands, kort en concreet, op het niveau van de leerling. Geef praktische studietips op basis van de gegevens en verzin geen cijfers of feiten. Vraag niet om persoonlijke gegevens.'+(b.context?' Gegevens van de leerling (kunnen onvolledig zijn): '+cut(b.context,1500):'');
   const t=await gem(key,{systemInstruction:{parts:[{text:sys}]},contents:m.map(x=>({role:x.r==='user'?'user':'model',parts:[{text:cut(x.t,2000)}]})),generationConfig:{maxOutputTokens:2048,temperature:.7}});
   return res.json({text:t})}
  return res.status(400).json({error:'Onbekende actie.'})
 }catch(e){return res.status(e.busy?429:502).json({error:e.message||'AI-fout'})}};
