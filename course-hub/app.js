(()=>{
  'use strict';

  const R=window.SLOKA_RUNTIME;
  const TOKEN_KEY='sloka_game_token';
  const NAME_KEY='sloka_game_first_name';
  const EMAIL_KEY='sloka_game_email';
  const grid=document.querySelector('#lessonGrid');
  const entryScreen=document.querySelector('#entryScreen');
  const adventures=document.querySelector('#adventures');
  const form=document.querySelector('#entryForm');
  const emailInput=document.querySelector('#classEmail');
  const continueButton=document.querySelector('#continueButton');
  const entryError=document.querySelector('#entryError');
  const playerGreeting=document.querySelector('#playerGreeting');
  const switchStudent=document.querySelector('#switchStudent');
  let manifest=[];

  function renderLessons(){
    const availableByWeek=new Map(manifest.map(lesson=>[lesson.weekNumber,lesson]));
    grid.replaceChildren();
    for(let number=1;number<=15;number++){
      const available=availableByWeek.get(number);
      const card=document.createElement('article');
      card.className=`lesson-card ${available?'active':'locked'}`;

      if(available){
        card.innerHTML=`
          <div class="card-top"><span class="sloka-label"></span><span class="state">Available</span></div>
          <div class="card-icon" aria-hidden="true"></div>
          <h3 class="lesson-title"></h3>
          <button class="start-button" type="button">Start Adventure</button>`;
        card.querySelector('.card-icon').textContent=available.icon||'✦';
        card.querySelector('.sloka-label').textContent=available.displayLabel||`Sloka ${number}`;
        card.querySelector('.lesson-title').textContent=available.title;
        card.querySelector('.start-button').addEventListener('click',()=>{
          window.location.href=available.href;
        });
      }else{
        card.innerHTML=`
          <div class="card-top"><span class="sloka-label">Sloka ${number}</span><span class="state">Coming Soon</span></div>
          <div class="card-icon" aria-hidden="true">✦</div>
          <p class="coming-message">A new adventure is on its way!</p>`;
        card.setAttribute('aria-label',`Sloka ${number}, coming soon`);
      }
      grid.appendChild(card);
    }
  }

  function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function token(){try{return localStorage.getItem(TOKEN_KEY)}catch{return null}}
  function clearIdentity(){try{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(NAME_KEY);localStorage.removeItem(EMAIL_KEY)}catch{}}
  function showEntry(message=''){
    adventures.classList.add('hidden');
    entryScreen.classList.remove('hidden');
    entryError.textContent=message;
    continueButton.disabled=false;
  }
  function showHub(){
    const name=localStorage.getItem(NAME_KEY)||'Friend';
    playerGreeting.textContent=`Hi, ${name}! 👋`;
    entryScreen.classList.add('hidden');
    adventures.classList.remove('hidden');
  }
  async function validateToken(savedToken){
    const validationLesson=manifest[0];
    const q=new URLSearchParams({seriesKey:validationLesson.seriesKey,weekNumber:String(validationLesson.weekNumber),practiceDate:today()});
    return fetch(`${R.apiBase}/player-progress?${q}`,{headers:{'x-game-token':savedToken}});
  }
  async function restoreSession(){
    const savedToken=token();
    if(!savedToken){showEntry();return}
    try{
      const response=await validateToken(savedToken);
      if(response.ok){showHub();return}
      if(response.status===401){clearIdentity();showEntry();return}
      showEntry("We couldn't connect right now. Please try again.");
    }catch{
      showEntry("We couldn't connect right now. Please try again.");
    }
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    entryError.textContent='';
    if(!emailInput.checkValidity()){
      entryError.textContent="Please enter your class email.";
      emailInput.focus();
      return;
    }
    continueButton.disabled=true;
    try{
      const email=emailInput.value.trim().toLowerCase();
      const response=await fetch(`${R.apiBase}/player-start`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok){
        if(response.status===404||result.code==='STUDENT_NOT_FOUND')throw new Error('NOT_FOUND');
        throw new Error('CONNECT');
      }
      localStorage.setItem(TOKEN_KEY,result.gameToken);
      localStorage.setItem(NAME_KEY,result.player?.firstName||'Friend');
      localStorage.setItem(EMAIL_KEY,email);
      showHub();
    }catch(error){
      entryError.textContent=error.message==='NOT_FOUND'
        ?"We couldn't find that class email. Please check it and try again."
        :"We couldn't connect right now. Please try again.";
    }finally{
      continueButton.disabled=false;
    }
  });

  switchStudent.addEventListener('click',()=>{
    clearIdentity();
    emailInput.value='';
    showEntry();
    emailInput.focus();
  });

  async function initialize(){
    if(!R?.apiBase){showEntry("We couldn't connect right now. Please try again.");return}
    try{
      const response=await fetch('lessons-manifest.json',{cache:'no-cache'});
      if(!response.ok)throw new Error(`Manifest request failed: ${response.status}`);
      const data=await response.json();
      if(!Array.isArray(data))throw new Error('Lesson manifest is not an array.');
      manifest=data.slice().sort((a,b)=>a.weekNumber-b.weekNumber);
    }catch(error){
      console.warn('Could not load lesson manifest.',error);
      showEntry("We couldn't load the adventures right now. Please try again.");
      return;
    }
    if(manifest.length===0){
      showEntry('No adventures are available yet. Please come back soon!');
      continueButton.disabled=true;
      return;
    }
    renderLessons();
    restoreSession();
  }

  initialize();
})();
