export class Sound {
 enabled=true;private ctx?:AudioContext;private last=0;private nextMusic=0;private note=0;
 unlock(){try{this.ctx??=new AudioContext();void this.ctx.resume();}catch{/* Audio remains optional on unsupported browsers. */}}
 tone(freq:number,duration=.1,type:OscillatorType='triangle',volume=.025,slide=0){
  if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,osc=c.createOscillator(),gain=c.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,c.currentTime);if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),c.currentTime+duration);
  gain.gain.setValueAtTime(volume,c.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);osc.connect(gain);gain.connect(c.destination);osc.start();osc.stop(c.currentTime+duration);
 }
 play(kind:string){
  const now=performance.now();if(kind==='projectile'&&now-this.last<65)return;this.last=now;
  if(kind==='tap'){this.tone(520,.045,'triangle',.028,220);this.tone(125,.045,'sine',.026,-35);}
  else if(kind==='shield')this.tone(340,.2,'triangle',.015,280);
  else if(kind==='heal'||kind==='buff')this.tone(780,.2,'sine',.012,160);
  else if(kind==='warning'){this.tone(196,.4,'square',.018);}
  else if(kind==='impact'||kind==='claw')this.tone(90,.25,'sawtooth',.025,-55);
  else if(kind==='projectile')this.tone(280,.09,'triangle',.013,-180);
  else if(kind==='coin')this.tone(1100,.12,'square',.008,300);
  else if(kind==='ultimate'||kind==='victory'){[262,330,392,523].forEach((n,i)=>setTimeout(()=>this.tone(n,.6,'triangle',.035),i*110));}
  else if(kind==='stance')this.tone(480,.09,'triangle',.02,160);
 }
 music(active:boolean){if(!active||!this.enabled)return;const now=performance.now();if(now<this.nextMusic)return;this.nextMusic=now+520;
  const melody=[147,0,220,0,196,0,165,0,131,0,196,0,220,0,165,196];const n=melody[this.note++%melody.length];if(n)this.tone(n,.5,'triangle',.008);if(this.note%4===0)this.tone(73,.45,'sine',.018);
 }
}
