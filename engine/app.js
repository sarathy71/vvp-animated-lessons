(()=>{
'use strict';
const R=window.SLOKA_RUNTIME,L=window.SLOKA_LESSON;
if(!R||!L){document.body.innerHTML='<p style="padding:30px">Missing runtime or lesson configuration.</p>';return;}
const API=R.apiBase,DAILY_GOAL=5,CHALLENGE_DAYS=5,TOKEN_KEY='sloka_game_token',NAME_KEY='sloka_game_first_name';
const $=s=>document.querySelector(s);
const login=$('#login'),game=$('#game'),form=$('#loginForm'),email=$('#email'),loginBtn=$('#loginBtn'),loginErr=$('#loginErr'),badge=$('#badge'),sceneImg=$('#sceneImg'),studentHud=$('#studentHud'),weekHud=$('#weekHud'),storyTitle=$('#storyTitle'),storySub=$('#storySub'),weeklyProgress=$('#weeklyProgress'),track=$('#track'),countLabel=$('#countLabel'),videoInset=$('#videoInset'),lessonVideo=$('#lessonVideo'),videoIcon=$('#videoIcon'),dailyBalls=$('#dailyBalls'),flyingBall=$('#flyingBall'),toastEl=$('#toast'),introCaption=$('#introCaption'),slokaText=$('#slokaText'),previewBtn=$('#previewBtn'),soundBtn=$('#soundBtn'),reloadBtn=$('#reloadBtn'),changeBtn=$('#changeBtn'),sfxBall=$('#sfxBall'),sfxVictory=$('#sfxVictory'),voicePlayer=$('#voicePlayer');
let weekProgress=0,lastPracticeDate=null,dailyRecitals=0,running=false,saving=false,soundOn=true,playerName='Friend';
let recitalActive=false,slokaTextReady=false;
let audioUnlocked=false,voicePreloadReady=false,voiceAudioContext=null,activeVoiceSource=null;
const voiceRawPromises=new Map(),voiceBuffers=new Map();
const GREETING_SCENES=Object.freeze({
 appu:{src:'assets/greetings/appu_hi.jpg',title:'Hi! I am Appu!',sub:''},
 tilli:{src:'assets/greetings/tilli_hi.jpg',title:'Hi! I am Tilli!',sub:''}
});
function token(){try{return localStorage.getItem(TOKEN_KEY)}catch{return null}}
function clearPlayerIdentity(){try{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(NAME_KEY);localStorage.removeItem('sloka_game_email')}catch{}}
function goToCourseHub(){window.location.replace('../course-hub/')}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function toast(m){toastEl.textContent=m;toastEl.classList.add('show');clearTimeout(toastEl._t);toastEl._t=setTimeout(()=>toastEl.classList.remove('show'),1300)}
function audioPath(key){const a=L.audio?.voice||{};return a[key]||null}
function voiceKeys(){return [
 'appuIntro','tilliIntro','appuHelp','tilliInstruction',
 'recitalCheer','dailyComplete','appuChallengeComplete','tilliThanks'
]}
function preloadVoiceFiles(){
 if(voicePreloadReady)return;
 voicePreloadReady=true;
 for(const key of voiceKeys()){
  const path=audioPath(key);
  if(!path||voiceRawPromises.has(path))continue;
  voiceRawPromises.set(path,fetch(path,{cache:'force-cache'}).then(r=>{
   if(!r.ok)throw new Error(`Voice preload failed: ${r.status} ${path}`);
   return r.arrayBuffer();
  }).catch(err=>{console.warn(err);return null}));
 }
}
function getAudioContext(){
 if(voiceAudioContext)return voiceAudioContext;
 const Ctx=window.AudioContext||window.webkitAudioContext;
 if(!Ctx)return null;
 voiceAudioContext=new Ctx();
 return voiceAudioContext;
}
async function decodeVoice(path){
 if(voiceBuffers.has(path))return voiceBuffers.get(path);
 const ctx=getAudioContext();
 if(!ctx)return null;
 let p=voiceRawPromises.get(path);
 if(!p){
  p=fetch(path,{cache:'force-cache'}).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null);
  voiceRawPromises.set(path,p);
 }
 const raw=await p;
 if(!raw)return null;
 try{
  const buf=await ctx.decodeAudioData(raw.slice(0));
  voiceBuffers.set(path,buf);
  return buf;
 }catch(err){console.warn('Voice decode failed',path,err);return null}
}
async function unlockAudio(){
 const ctx=getAudioContext();
 if(!ctx){audioUnlocked=true;return}
 try{
  const resumePromise=ctx.resume();
  const silent=ctx.createBuffer(1,1,22050);
  const src=ctx.createBufferSource();
  src.buffer=silent;
  src.connect(ctx.destination);
  src.start(0);
  await resumePromise;
  audioUnlocked=ctx.state==='running';
  await Promise.all(voiceKeys().map(k=>{const p=audioPath(k);return p?decodeVoice(p):Promise.resolve(null)}));
 }catch(err){
  console.warn('Audio unlock failed',err);
  audioUnlocked=false;
 }
}
async function showSceneAndVoice(scene,key,leadMs=120,tailMs=220){
 showScene(scene);
 await sleep(leadMs);
 await playSequence([key]);
 if(tailMs>0)await sleep(tailMs);
}
async function playFile(path){
 if(!soundOn||!path)return;
 const ctx=getAudioContext();
 if(ctx&&audioUnlocked&&ctx.state==='running'){
  const buf=await decodeVoice(path);
  if(buf){
   return new Promise(resolve=>{
    try{if(activeVoiceSource)activeVoiceSource.stop()}catch{}
    const source=ctx.createBufferSource();
    const gain=ctx.createGain();
    gain.gain.value=1;
    source.buffer=buf;
    source.connect(gain);gain.connect(ctx.destination);
    activeVoiceSource=source;
    source.onended=()=>{if(activeVoiceSource===source)activeVoiceSource=null;resolve()};
    source.start(0);
   });
  }
 }
 return new Promise(resolve=>{
  let settled=false;
  const finish=()=>{if(settled)return;settled=true;voicePlayer.onended=null;voicePlayer.onerror=null;resolve()};
  try{voicePlayer.pause();voicePlayer.currentTime=0}catch{}
  voicePlayer.muted=false;voicePlayer.volume=1;voicePlayer.onended=finish;voicePlayer.onerror=finish;voicePlayer.src=path;
  voicePlayer.play().catch(err=>{console.warn('Voice playback blocked',err);finish()});
 });
}
async function playSequence(keys){for(const k of keys){const p=audioPath(k);if(p)await playFile(p)}}
function playSfx(el,path){if(!soundOn||!path)return;try{el.src=path;el.currentTime=0;el.play().catch(()=>{})}catch{}}
function setSound(v){soundOn=v;soundBtn.textContent=v?'🔊 Sound on':'🔇 Sound off';lessonVideo.muted=!v;try{localStorage.setItem('sloka_sound_on',v?'1':'0')}catch{}}
function sceneForProgress(n){if(n<=0)return L.scenes.intro.at(-1);return L.scenes.days[Math.min(n,5)-1]}
function isIntroLikeScene(s){if(!s)return false;if(s===GREETING_SCENES.appu||s===GREETING_SCENES.tilli)return true;return (L.scenes?.intro||[]).includes(s)}
function introCaptionText(s){if(!s)return '';if(s===GREETING_SCENES.appu)return GREETING_SCENES.appu.title||'Hi! I am Appu!';if(s===GREETING_SCENES.tilli)return GREETING_SCENES.tilli.title||'Hi! I am Tilli!';return s.sub||s.title||''}
function showScene(s){if(!s)return;sceneImg.src=s.src;storyTitle.textContent=s.title||'';storySub.textContent=s.sub||'';const cap=isIntroLikeScene(s)?introCaptionText(s):'';if(introCaption){introCaption.textContent=cap;introCaption.classList.toggle('hidden',!cap)}}
async function loadSlokaText(){const r=await fetch('assets/sloka/sloka.txt');if(!r.ok)throw new Error(`Could not load sloka text (${r.status})`);slokaText.textContent=await r.text();slokaTextReady=true;renderSlokaText()}
function renderSlokaText(){slokaText.classList.toggle('hidden',!slokaTextReady||!recitalActive||running||saving||lessonVideo.ended)}
function buildStaticUI(){document.title=L.title;$('#lessonTitle').textContent=L.title;$('#lessonSubtitle').textContent=L.headerSubtitle||'';lessonVideo.src=L.video;weeklyProgress.innerHTML='';track.innerHTML='';for(let i=0;i<5;i++){const d=document.createElement('div');d.className='week-slot';d.innerHTML=`<img alt="" src="${L.progressIcon}"><b>${i+1}</b>`;weeklyProgress.appendChild(d);const s=document.createElement('span');s.className='seg';track.appendChild(s)}dailyBalls.innerHTML='';for(let i=0;i<5;i++){const b=document.createElement('span');b.className='ball-slot';b.dataset.i=String(i);dailyBalls.appendChild(b)}}
function render(){studentHud.textContent=`Hi, ${playerName}!`;weekHud.textContent=`${weekProgress} of 5`;countLabel.textContent=`${weekProgress} / 5`;[...weeklyProgress.children].forEach((e,i)=>e.classList.toggle('on',i<weekProgress));[...track.children].forEach((e,i)=>e.classList.toggle('on',i<weekProgress));[...dailyBalls.children].forEach((e,i)=>{e.classList.toggle('filled',i<dailyRecitals);e.classList.toggle('next',i===dailyRecitals&&dailyRecitals<5&&!isDayComplete()&&!running&&!saving)});renderVideoState();renderSlokaText()}
function isDayComplete(){return lastPracticeDate===today()||dailyRecitals>=5}
function renderVideoState(){videoInset.classList.remove('done','locked','playing');if(weekProgress>=5){videoInset.classList.add('done','locked');videoIcon.textContent='★'}else if(isDayComplete()){videoInset.classList.add('done','locked');videoIcon.textContent='✓'}else if(running||saving){videoInset.classList.add('locked');videoIcon.textContent='…'}else if(!lessonVideo.paused&&!lessonVideo.ended){videoInset.classList.add('playing');videoIcon.textContent='▶'}else{videoIcon.textContent='▶'}const p=(lessonVideo.duration&&isFinite(lessonVideo.duration))?(lessonVideo.currentTime/lessonVideo.duration)*100:0;videoInset.style.setProperty('--video-progress',`${p}%`)}
async function signIn(em){const r=await fetch(`${API}/player-start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Sign in failed');localStorage.setItem(TOKEN_KEY,j.gameToken);localStorage.setItem(NAME_KEY,j.player?.firstName||'Friend');playerName=j.player?.firstName||'Friend'}
async function loadState(){const q=new URLSearchParams({seriesKey:L.seriesKey,weekNumber:String(L.weekNumber),practiceDate:today()});const r=await fetch(`${API}/player-progress?${q}`,{headers:{'x-game-token':token()}});const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||'Could not load progress');e.status=r.status;e.code=j.code;throw e}return j}
async function validateSavedSession(){try{await loadState()}catch(e){if(e.status===401||e.code==='INVALID_SESSION'){clearPlayerIdentity();goToCourseHub()}}}
function pendingKey(){return `sloka_pending_recital_v1_${token()||'anon'}_${L.lessonId}_${today()}`}
function getPending(){try{return localStorage.getItem(pendingKey())}catch{return null}}
function setPending(v){try{v?localStorage.setItem(pendingKey(),v):localStorage.removeItem(pendingKey())}catch{}}
async function recordRecital(eventId){const r=await fetch(`${API}/player-progress`,{method:'POST',headers:{'Content-Type':'application/json','x-game-token':token()},body:JSON.stringify({action:'recital',eventId,seriesKey:L.seriesKey,weekNumber:L.weekNumber,practiceDate:today()})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not save recital');return j}
async function animateBallTo(slotIndex){const slot=dailyBalls.children[slotIndex];if(!slot)return;const from=videoInset.getBoundingClientRect(),to=slot.getBoundingClientRect();const sx=from.left+from.width/2-24,sy=from.top+from.height/2-24,tx=to.left+to.width/2-24,ty=to.top+to.height/2-24;flyingBall.classList.remove('hidden');flyingBall.style.left=`${sx}px`;flyingBall.style.top=`${sy}px`;const dx=tx-sx,dy=ty-sy;const anim=flyingBall.animate([{transform:'translate(0,0) scale(.9)'},{transform:`translate(${dx*.52}px,${dy*.25-90}px) scale(1.15)`,offset:.52},{transform:`translate(${dx}px,${dy}px) scale(.72)`}],{duration:850,easing:'cubic-bezier(.25,.8,.3,1)'});await anim.finished.catch(()=>{});flyingBall.classList.add('hidden');playSfx(sfxBall,L.audio?.sfx?.ballLand);}
async function handleRecitalComplete(){
 if(saving||running||weekProgress>=5||isDayComplete())return;
 saving=true;render();
 let id=getPending();
 if(!id){id=crypto.randomUUID();setPending(id)}
 try{
  const beforeWeek=weekProgress;
  const beforeDaily=dailyRecitals;
  const j=await recordRecital(id);
  setPending(null);

  const rawDaily=Number(j?.daily?.recitalCount??beforeDaily);
  const newDaily=Math.max(beforeDaily,Math.min(5,Number.isFinite(rawDaily)?rawDaily:beforeDaily));
  const completedFive=Boolean(j?.daily?.completed)&&newDaily>=5;
  const rawWeek=Number(j?.progress?.practice_count??beforeWeek);
  const proposedWeek=Number.isFinite(rawWeek)?rawWeek:beforeWeek;

  if(newDaily>beforeDaily){
   await animateBallTo(newDaily-1);
   dailyRecitals=newDaily;
   render();
   await playSequence(['recitalCheer']);
  }else{
   dailyRecitals=newDaily;
   render();
  }

  if(proposedWeek>beforeWeek&&!completedFive){
   console.warn('Blocked premature weekly progress advance',{beforeWeek,proposedWeek,newDaily,completed:j?.daily?.completed});
   toast('Fill 5 small balls before the mango moves.');
  }

  if(completedFive&&proposedWeek>beforeWeek){
   weekProgress=proposedWeek;
   dailyRecitals=5;
   lastPracticeDate=j.progress?.last_practice_date||lastPracticeDate;
   showScene(sceneForProgress(weekProgress));
   render();
   await playSequence(['dailyComplete']);
   if(weekProgress>=5){
    playSfx(sfxVictory,L.audio?.sfx?.victory);
    for(const s of L.scenes.finale){showScene(s);await sleep(1200)}
    await playSequence(['appuChallengeComplete','tilliThanks']);
   }
  }else{
   weekProgress=beforeWeek;
   render();
  }
 }catch(e){
  toast(e.message||'Try again');
 }finally{
  saving=false;
  lessonVideo.currentTime=0;
  render();
 }
}
function startVideo(){if(running||saving||weekProgress>=5||isDayComplete())return;lessonVideo.play().catch(()=>toast('Tap again to play'))}
async function playIntro(){
 running=true;render();
 await showSceneAndVoice(GREETING_SCENES.appu,'appuIntro',120,220);
 await showSceneAndVoice(GREETING_SCENES.tilli,'tilliIntro',120,260);
 const intro=L.scenes.intro||[];
 for(let i=0;i<intro.length;i++){
  showScene(intro[i]);
  if(i===3){await sleep(120);await playSequence(['appuHelp']);await sleep(220);}
  else if(i===4){await sleep(120);await playSequence(['tilliInstruction']);await sleep(280);}
  else{await sleep(1150);}
 }
 running=false;showScene(sceneForProgress(weekProgress));render();
}
async function preview(){if(running||saving)return;const saved=sceneForProgress(weekProgress);recitalActive=false;running=true;previewBtn.disabled=true;lessonVideo.pause();renderSlokaText();for(const s of L.scenes.intro){showScene(s);await sleep(750)}for(const s of L.scenes.days){showScene(s);await sleep(750)}for(const s of L.scenes.finale){showScene(s);await sleep(750)}showScene(saved);running=false;previewBtn.disabled=false;render()}
async function enter(){login.classList.add('hidden');game.classList.remove('hidden');badge.textContent=`Lesson ${L.weekNumber}`;try{playerName=localStorage.getItem(NAME_KEY)||'Friend';const j=await loadState();weekProgress=Number(j.progress?.practice_count||0);lastPracticeDate=j.progress?.last_practice_date||null;dailyRecitals=Math.min(5,Number(j.daily?.recitalCount||0));if(j.daily?.completed)dailyRecitals=5;showScene(sceneForProgress(weekProgress));render();if(weekProgress===0)await playIntro()}catch(e){if(e.status===401||e.code==='INVALID_SESSION'){clearPlayerIdentity();goToCourseHub();return}game.classList.add('hidden');login.classList.remove('hidden');loginErr.textContent=e.message}}
form.addEventListener('submit',async e=>{e.preventDefault();loginErr.textContent='';loginBtn.disabled=true;try{
 await unlockAudio();
 const entered=email.value.trim();
 if(token()&&!entered)await enter();
 else{await signIn(entered);await enter()}
}catch(err){loginErr.textContent=err.message}finally{loginBtn.disabled=false}});
videoInset.addEventListener('click',startVideo);lessonVideo.addEventListener('timeupdate',renderVideoState);lessonVideo.addEventListener('play',()=>{if(!running&&!saving)recitalActive=true;render()});lessonVideo.addEventListener('pause',renderVideoState);lessonVideo.addEventListener('ended',()=>{recitalActive=false;renderSlokaText();handleRecitalComplete()});previewBtn.addEventListener('click',preview);soundBtn.addEventListener('click',()=>setSound(!soundOn));reloadBtn.addEventListener('click',enter);changeBtn.addEventListener('click',()=>{recitalActive=false;lessonVideo.pause();renderSlokaText();clearPlayerIdentity();goToCourseHub()});
buildStaticUI();loadSlokaText().catch(err=>console.error(err));preloadVoiceFiles();setSound((()=>{try{return localStorage.getItem('sloka_sound_on')!=='0'}catch{return true}})());
if(token()){email.required=false;email.value='';email.placeholder='';loginBtn.textContent='Continue';validateSavedSession()}else{goToCourseHub()}
})();
