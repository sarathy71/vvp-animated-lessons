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
  const lessons=Array.from({length:15},(_,index)=>{
    const number=index+1;
    return number===2
      ?{number,title:'The Five Lost Mangoes',available:true}
      :{number,title:'Coming Soon',available:false};
  });

  for(const lesson of lessons){
    const card=document.createElement('article');
    card.className=`lesson-card ${lesson.available?'active':'locked'}`;

    if(lesson.available){
      card.innerHTML=`
        <div class="card-top"><span class="sloka-label">Sloka ${lesson.number}</span><span class="state">Available</span></div>
        <div class="card-icon" aria-hidden="true">🥭</div>
        <h3 class="lesson-title">${lesson.title}</h3>
        <button class="start-button" type="button">Start Adventure</button>`;
      card.querySelector('.start-button').addEventListener('click',()=>{
        window.location.href='../sloka-02-mangoes/';
      });
    }else{
      card.innerHTML=`
        <div class="card-top"><span class="sloka-label">Sloka ${lesson.number}</span><span class="state">Coming Soon</span></div>
        <div class="card-icon" aria-hidden="true">✦</div>
        <p class="coming-message">A new adventure is on its way!</p>`;
      card.setAttribute('aria-label',`Sloka ${lesson.number}, coming soon`);
    }
    grid.appendChild(card);
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
    const q=new URLSearchParams({seriesKey:'appu',weekNumber:'2',practiceDate:today()});
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

  if(!R?.apiBase){showEntry("We couldn't connect right now. Please try again.")}
  else restoreSession();
})();
