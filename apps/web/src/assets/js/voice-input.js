(function(){
  const input=document.getElementById('inp');
  const send=document.getElementById('send');
  const bar=document.getElementById('voiceInputBar');
  const mic=document.getElementById('voiceInputBtn');
  const submit=document.getElementById('voiceSubmitBtn');
  const status=document.getElementById('voiceInputStatus');
  if(!input||!send||!bar||!mic||!submit||!status)return;

  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null;
  let listening=false;
  let finalTranscript='';

  function setStatus(message,kind){
    const cls=kind==='ok'?'ok':kind==='err'?'err':kind==='warn'?'warn':'';
    status.innerHTML=cls?`<span class="${cls}">${message}</span>`:message;
  }

  function setListening(next){
    listening=next;
    mic.classList.toggle('is-listening',listening);
    mic.textContent=listening?'■ Stop voice':'🎙 Speak';
  }

  function submitText(){
    const value=input.value.trim();
    if(!value){setStatus('Nothing to submit. Type or speak a command first.','warn');return;}
    send.click();
  }

  submit.addEventListener('click',submitText);

  if(!SpeechRecognition){
    mic.disabled=true;
    mic.classList.add('is-unsupported');
    submit.disabled=false;
    setStatus('Voice input is not supported in this browser. Text fallback is active.','warn');
    return;
  }

  recognition=new SpeechRecognition();
  recognition.lang='en-US';
  recognition.interimResults=true;
  recognition.continuous=false;
  recognition.maxAlternatives=1;

  recognition.onstart=function(){
    finalTranscript='';
    setListening(true);
    setStatus('Listening, sir. Speak your command.','ok');
  };

  recognition.onresult=function(event){
    let interim='';
    for(let i=event.resultIndex;i<event.results.length;i++){
      const text=(event.results[i][0]&&event.results[i][0].transcript)||'';
      if(event.results[i].isFinal) finalTranscript+=text;
      else interim+=text;
    }
    const transcript=(finalTranscript||interim||'').replace(/\s+/g,' ').trim();
    if(transcript){
      input.value=transcript;
      submit.disabled=false;
      setStatus('Transcript captured. You may edit it or submit to LIFE.SAVER.','ok');
    }
  };

  recognition.onerror=function(event){
    setListening(false);
    const err=event&&event.error?event.error:'unknown';
    setStatus(`Voice input stopped: ${err}. Text fallback remains active.`,'err');
  };

  recognition.onend=function(){
    setListening(false);
    const value=input.value.trim();
    submit.disabled=!value;
    if(value)setStatus('Voice command ready. Review, edit, then submit.','ok');
    else setStatus('No transcript captured. Text fallback remains active.','warn');
  };

  mic.addEventListener('click',function(){
    try{
      if(listening){recognition.stop();return;}
      recognition.start();
    }catch(e){
      setListening(false);
      setStatus('Voice input could not start. Please use text fallback.','err');
    }
  });

  input.addEventListener('input',function(){submit.disabled=!input.value.trim();});
  submit.disabled=!input.value.trim();
  setStatus('Voice input ready where browser permission is available. Text fallback remains active.','ok');
})();
