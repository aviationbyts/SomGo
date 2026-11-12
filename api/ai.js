const cut=(s,n)=>String(s||'').slice(0,n);
const models=()=>[process.env.GEMINI_MODEL,'gemini-3.5-flash-lite','gemini-3.5-flash','gemini-2.5-flash'].filter((m,i,a)=>m&&a.indexOf(m)===i);
async function gem(key,payload){const t0=Date.now();let last='',busy=false,slow=false;
 for(const m of models()){
  for(const v of [1,0]){
   const left=24000-(Date.now()-t0);if(left<3000){slow=true;break}
   const body=v?{...payload,generationConfig:{...payload.generationConfig,thinkingConfig:{thinkingBudget:0}}}:payload;
   try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body),signal:AbortSignal.timeout(Math.min(12000,left))});
    const j=await r.json().catch(()=>({}));
    if(r.ok){const p=(((j.candidates||[])[0]||{}).content||{}).parts||[],t=p.map(x=>x.text||'').join('');if(t)return t;last='leeg';break}
    last=r.status;if(r.status===429)busy=true;if(r.status===400&&v)continue;break}
   catch(e){last='tijd';slow=true;break}}
  if(Date.now()-t0>=22000)break}
 const e=new Error(busy?'De AI is druk. Probeer het over een minuut opnieuw.':slow?'De AI reageert te traag. Probeer het opnieuw.':'De AI is niet beschikbaar ('+last+').');e.busy=busy;throw e}
module.exports=async(req,res)=>{
 if(req.method!=='POST')return res.status(405).json({error:'Alleen POST'});
 const key=process.env.GEMINI_API_KEY,su=process.env.SUPABASE_URL,sk=process.env.SUPABASE_KEY,lim=+process.env.AI_DAILY_LIMIT||30;
 if(!key||!su||!sk)return res.status(500).json({error:'AI is nog niet ingesteld op de server.'});
 let n;try{const r=await fetch(su+'/rest/v1/rpc/ai_hit',{method:'POST',headers:{apikey:sk,Authorization:req.headers.authorization||'','Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)});
  if(r.status===401||r.status===403)return res.status(401).json({error:'Log opnieuw in.'});if(!r.ok)return res.status(500).json({error:'Controle mislukt.'});n=await r.json()}catch(e){return res.status(500).json({error:'Controle mislukt.'})}
 if(n>lim)return res.status(429).json({error:'Je daglimiet voor AI is bereikt. Probeer het morgen weer.'});
 const b=req.body||{};
 try{
  if(b.mode==='cards'){const q=cut(b.text,8000),img=typeof b.image==='string'&&b.image.length<3000000&&/^[A-Za-z0-9+\/=]+$/.test(b.image)?b.image:'';if(q.length<3&&!img)return res.status(400).json({error:'Geen tekst of foto.'});const k=Math.min(25,Math.max(3,+b.n||10));
   const prompt=`Maak ${k} flashcards (kort begrip of vraag, kort antwoord) in het Nederlands voor ${cut(b.level,40)||'de middelbare school'}${b.vak?', vak '+cut(b.vak,40):''}, over ${img?'de inhoud van de bijgevoegde foto (schoolboek of aantekeningen)'+(q?' en dit onderwerp':''):'dit onderwerp of deze tekst'}:\n"""${q}"""\nAntwoord alleen met JSON in dit formaat: {"cards":[{"q":"...","a":"..."}]}`;
   const t=await gem(key,{contents:[{role:'user',parts:[{text:prompt},...(img?[{inlineData:{mimeType:'image/jpeg',data:img}}]:[])]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:4096,temperature:.4}});
   let j;try{j=JSON.parse(t.replace(/^```(?:json)?|```$/g,'').trim())}catch(e){return res.status(502).json({error:'De AI gaf een onleesbaar antwoord. Probeer het opnieuw.'})}
   const cards=(Array.isArray(j)?j:j.cards||[]).filter(c=>c&&c.q&&c.a).slice(0,25).map(c=>({q:cut(c.q,200),a:cut(c.a,300)}));
   if(!cards.length)return res.status(502).json({error:'Geen kaarten gemaakt. Probeer het opnieuw.'});return res.json({cards})}
  if(b.mode==='chat'||b.mode==='quiz'){let m=(Array.isArray(b.messages)?b.messages:[]).slice(-12);while(m.length&&m[0].r!=='user')m.shift();if(!m.length)return res.status(400).json({error:'Geen bericht.'});
   const quiz=b.mode==='quiz',sys=quiz?'Je bent een vriendelijke overhoorder voor een Nederlandse middelbare scholier. Overhoor de leerling over de begrippen hieronder. Stel steeds precies één vraag, wacht op het antwoord, beoordeel kort (goed, fout of gedeeltelijk, met de juiste uitleg) en stel dan de volgende vraag. Wissel af tussen begrip naar uitleg en uitleg naar begrip. Na 10 vragen geef je een korte score en tips. Begrippen:\n'+cut(b.context,5000):'Je bent de SomGo-coach, een vriendelijke studiecoach voor Nederlandse middelbare scholieren. Antwoord in het Nederlands, kort en concreet, op het niveau van de leerling. Geef praktische studietips op basis van de gegevens en verzin geen cijfers of feiten. Vraag niet om persoonlijke gegevens.'+(b.context?' Gegevens van de leerling (kunnen onvolledig zijn): '+cut(b.context,1500):'');
   const t=await gem(key,{systemInstruction:{parts:[{text:sys}]},contents:m.map(x=>({role:x.r==='user'?'user':'model',parts:[{text:cut(x.t,2000)}]})),generationConfig:{maxOutputTokens:2048,temperature:.7}});
   return res.json({text:t})}
  return res.status(400).json({error:'Onbekende actie.'})
 }catch(e){return res.status(e.busy?429:502).json({error:e.message||'AI-fout'})}};
