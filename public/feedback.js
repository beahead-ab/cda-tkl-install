// A local acknowledgement sound replaces unavailable JMRI sound files.
// Enabling it requires an explicit user gesture; errors always remain visible.
export function createFeedback() {
  const button=document.getElementById('sound-toggle'),lamp=document.getElementById('error-lamp');
  let enabled=localStorage.getItem('tkl-sound')==='yes',audio,last=0,timer;
  const paint=()=>{button.textContent=enabled?'Ljud på':'Ljud av';button.setAttribute('aria-pressed',String(enabled));};
  async function beep(){try{audio??=new AudioContext();await audio.resume();const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.frequency.value=540;gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.16);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.17);}catch{}}
  button.onclick=()=>{enabled=!enabled;localStorage.setItem('tkl-sound',enabled?'yes':'no');paint();if(enabled)beep();};paint();
  // A neighbour's clearance request rings like a TMBox: two rising tones, only with Ljud på.
  async function ring(){if(!enabled)return;try{audio??=new AudioContext();await audio.resume();for(const [i,f] of [660,880].entries()){const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.22;o.frequency.value=f;g.gain.setValueAtTime(.08,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.21);}}catch{}}
  return {ring,error(){lamp.hidden=false;clearTimeout(timer);timer=setTimeout(()=>{lamp.hidden=true;},3000);if(enabled&&Date.now()-last>1000){last=Date.now();beep();}}};
}
