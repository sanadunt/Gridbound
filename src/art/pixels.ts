import type Phaser from 'phaser';
import { type ClassId, KITS } from '../game/content';

type C = CanvasRenderingContext2D;
const rect=(c:C,x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
const poly=(c:C,points:number[][],color:string)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
function canvas(w:number,h:number){const el=document.createElement('canvas');el.width=w;el.height=h;const c=el.getContext('2d')!;c.imageSmoothingEnabled=false;return {el,c};}
const ink='#111d25',skin='#e9bb89',skinShade='#ab7867';

export function heroCanvas(cls:ClassId,frame=0){
 const {el,c}=canvas(40,44);const bob=frame===1?-1:frame===3?1:0;c.translate(0,bob);
 const color=KITS[cls].color;const dark={warrior:'#786143',rogue:'#514669',archer:'#4e6548',healer:'#347876',wizard:'#425a8b'}[cls];
 // Each silhouette is authored in pixel coordinates; palette highlights share the same light direction.
 rect(c,12,34,6,6,ink);rect(c,23,34,6,6,ink);rect(c,13,34,4,4,dark);rect(c,24,34,4,4,dark);
 rect(c,11,39,7,2,'#736852');rect(c,23,39,7,2,'#736852');
 if(cls==='healer'||cls==='wizard'){poly(c,[[13,20],[27,20],[31,37],[9,37]],ink);poly(c,[[14,21],[26,21],[29,35],[11,35]],dark);poly(c,[[17,21],[23,21],[25,35],[14,35]],color);rect(c,18,23,3,12,'#d8d7ad');}
 else {rect(c,11,20,18,15,ink);rect(c,13,21,14,12,dark);rect(c,14,21,11,7,color);rect(c,13,30,14,3,'#695245');rect(c,19,30,3,3,'#e3b976');}
 rect(c,10,22,4,10,ink);rect(c,26,22,4,10,ink);rect(c,10,23,3,6,dark);rect(c,27,23,3,6,color);rect(c,10,29,3,3,skin);rect(c,27,29,3,3,skin);
 rect(c,12,6,16,16,ink);rect(c,14,8,12,13,skinShade);rect(c,14,8,11,10,skin);rect(c,14,17,10,3,skinShade);rect(c,15,13,2,2,ink);rect(c,22,13,2,2,ink);rect(c,17,18,5,1,'#e3a578');
 if(cls==='warrior'){
  poly(c,[[11,6],[14,3],[25,3],[29,7],[29,16],[25,16],[25,8],[15,8],[15,16],[11,16]],ink);
  rect(c,13,6,14,5,'#829ba0');rect(c,15,4,10,4,'#b5c6bf');rect(c,17,3,4,7,'#f0d899');rect(c,11,9,4,7,'#596f78');rect(c,26,8,3,8,'#596f78');
  rect(c,8,21,7,5,'#c6bb8c');rect(c,25,21,7,5,'#e5d7a9');rect(c,15,23,10,5,'#9eb5aa');
  poly(c,[[3,24],[12,22],[16,25],[14,35],[9,39],[3,35]],ink);poly(c,[[5,25],[11,24],[14,26],[12,34],[9,36],[5,33]],'#c59251');rect(c,8,25,2,10,'#f4d895');rect(c,5,28,8,2,'#f4d895');
  rect(c,32,10,2,21,ink);rect(c,31,12,4,15,'#b5d5cd');rect(c,32,9,2,18,'#f1efc5');rect(c,29,27,8,2,'#e4b868');rect(c,32,29,2,6,'#916140');
 }else if(cls==='rogue'){
  poly(c,[[10,10],[14,3],[25,3],[29,10],[27,16],[25,9],[14,9],[13,16]],ink);poly(c,[[12,9],[15,5],[24,5],[27,10],[24,11],[15,11]],color);
  rect(c,13,16,14,6,dark);rect(c,14,17,12,2,color);rect(c,25,19,8,3,color);rect(c,29,22,6,3,dark);
  poly(c,[[4,25],[7,20],[9,31],[7,33]],'#e6e2c5');poly(c,[[31,28],[36,20],[35,32],[32,35]],'#e6e2c5');rect(c,5,32,5,2,'#c9a66d');rect(c,31,33,6,2,'#c9a66d');
 }else if(cls==='archer'){
  poly(c,[[10,9],[15,2],[27,4],[30,10]],ink);poly(c,[[12,8],[16,4],[25,5],[27,9]],color);rect(c,12,9,17,3,dark);
  rect(c,24,2,2,6,'#d2a174');rect(c,26,0,2,4,'#f3d29b');rect(c,13,19,13,3,'#677943');
  poly(c,[[30,16],[34,19],[37,26],[35,34],[31,38],[33,33],[34,26],[32,20]],'#e8bf79');rect(c,31,17,1,20,'#ded8b2');rect(c,28,27,10,1,'#f6e7c1');rect(c,36,26,3,3,'#c1dcd3');
 }else if(cls==='healer'){
  poly(c,[[11,11],[12,7],[15,4],[25,4],[28,8],[28,15],[25,11],[24,8],[15,8],[14,13]],'#dce6d5');rect(c,11,13,3,9,'#b3d8c5');rect(c,26,12,3,10,'#80afa1');rect(c,18,4,3,5,'#d4b675');
  rect(c,33,15,2,24,'#c1a471');rect(c,30,10,8,7,ink);rect(c,32,8,4,10,'#ddc992');rect(c,29,11,10,4,'#ddc992');rect(c,32,11,4,4,'#8df3d2');
 }else{
  poly(c,[[9,12],[15,3],[18,0],[21,3],[26,8],[31,11],[31,14],[9,14]],ink);poly(c,[[11,11],[17,3],[19,2],[22,7],[28,11]],color);rect(c,11,11,18,2,dark);rect(c,18,7,3,3,'#eee0ac');rect(c,14,17,10,4,'#cfdfdf');
  rect(c,33,15,2,25,'#b28468');poly(c,[[29,13],[31,7],[36,5],[39,10],[37,15],[32,17]],'#233c64');poly(c,[[31,11],[33,7],[36,7],[37,10],[35,14],[32,14]],'#a0ddf2');rect(c,33,8,2,3,'#f1fff2');
 }
 return el;
}

export function dragon(frame:number){
 const {el,c}=canvas(168,116);const flap=Math.round(Math.sin(frame/8*Math.PI*2)*5);
 const edge='#102e30',shade='#195344',mid='#368a66',light='#78b77c',gold='#dab978';
 // Scalloped membranes and segmented wing bones make the dragon readable even at mobile scale.
 poly(c,[[72,49],[47,24+flap],[25,11+flap],[4,5+flap],[12,37],[5,53],[22,44],[31,59],[44,53],[59,69],[77,67]],edge);
 poly(c,[[69,49],[44,26+flap],[9,9+flap],[20,38],[13,44],[26,40],[34,52],[46,48],[60,61]],'#a2704d');
 poly(c,[[69,49],[43,27+flap],[20,18+flap],[32,39],[36,47],[47,44]],'#c9935d');
 poly(c,[[95,49],[121,24+flap],[144,11+flap],[166,5+flap],[157,37],[165,53],[147,44],[138,59],[125,53],[110,69],[92,67]],edge);
 poly(c,[[98,49],[125,26+flap],[162,9+flap],[150,38],[158,44],[144,40],[135,52],[123,48],[110,61]],'#a2704d');
 poly(c,[[101,49],[128,27+flap],[151,18+flap],[139,39],[133,47],[122,44]],'#c9935d');
 for(const side of [-1,1]){poly(c,[[84+side*10,52],[84+side*39,25+flap],[84+side*76,8+flap],[84+side*40,31+flap],[84+side*19,60]],shade);poly(c,[[84+side*15,53],[84+side*47,47],[84+side*56,54],[84+side*42,43]],light);}
 // Tail curls below the body, leaving a distinct negative space between the legs.
 poly(c,[[98,73],[115,77],[127,88],[147,90],[158,82],[155,95],[146,103],[124,101],[111,94],[93,94]],edge);
 poly(c,[[100,77],[114,82],[126,93],[145,96],[154,88],[150,97],[126,98],[110,89],[97,90]],mid);
 poly(c,[[127,94],[145,96],[153,90],[147,96],[134,98]],light);
 poly(c,[[73,46],[98,44],[109,58],[112,82],[101,99],[73,100],[62,85],[62,66]],edge);
 poly(c,[[75,49],[95,48],[104,61],[105,82],[98,94],[75,95],[68,82],[68,65]],mid);
 poly(c,[[78,58],[94,55],[99,67],[97,88],[88,96],[77,90],[74,72]],'#b2b37a');
 for(let y=66;y<92;y+=6)rect(c,77,y,19,2,'#747f58');
 poly(c,[[68,71],[57,80],[51,97],[61,104],[75,102],[78,95],[70,90],[77,79]],edge);
 poly(c,[[102,73],[115,80],[122,97],[116,104],[100,101],[96,95],[103,90],[98,80]],edge);
 poly(c,[[67,78],[61,83],[58,95],[64,98],[72,96],[67,90],[73,81]],shade);
 poly(c,[[103,79],[112,84],[116,96],[109,98],[100,95],[106,90]],shade);
 for(const x of [58,65,105,112])rect(c,x,98,4,5,gold);
 poly(c,[[73,47],[65,40],[65,22],[73,15],[94,14],[108,22],[111,37],[102,52],[86,58]],edge);
 poly(c,[[73,42],[69,33],[71,22],[78,19],[93,18],[104,24],[107,35],[99,48],[86,53]],mid);
 poly(c,[[74,23],[78,20],[89,20],[93,26],[85,30],[74,29]],light);
 poly(c,[[71,23],[65,16],[64,6],[68,9],[73,17],[78,19]],gold);
 poly(c,[[96,20],[105,10],[107,3],[110,9],[108,20],[103,25]],gold);
 rect(c,70,31,13,6,edge);rect(c,72,31,9,3,'#f3b56e');rect(c,76,31,2,4,'#ffecb0');
 rect(c,96,29,9,6,edge);rect(c,97,29,7,3,'#f3b56e');
 poly(c,[[82,36],[101,35],[109,40],[107,47],[100,51],[81,48],[76,43]],shade);
 rect(c,94,37,3,2,edge);rect(c,102,39,3,2,edge);rect(c,81,45,24,2,edge);rect(c,83,46,3,4,'#eee1ae');rect(c,99,46,3,3,'#eee1ae');
 rect(c,73,53,4,7,light);rect(c,101,54,3,6,light);
 for(const [x,y] of [[69,66],[99,65],[101,77],[71,84],[115,85],[127,91]])rect(c,x,y,3,2,light);
 return el;
}

export function background(){
 const {el,c}=canvas(300,380);let seed=1849;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 rect(c,0,0,300,380,'#152d2c');
 for(let y=0;y<185;y+=4)rect(c,0,y,300,4,`rgb(${17+y*.05},${34+y*.13},${36+y*.1})`);
 c.fillStyle='#d5bb7b';c.beginPath();c.arc(150,59,30,0,Math.PI*2);c.fill();
 c.fillStyle='#eedaa0';c.beginPath();c.arc(147,56,24,0,Math.PI*2);c.fill();
 for(let i=0;i<45;i++){const x=rnd()*300,y=rnd()*100;rect(c,x,y,1,1,'#71998a');}
 poly(c,[[0,126],[20,83],[44,102],[74,60],[103,102],[143,79],[182,101],[228,64],[262,100],[281,70],[300,105],[300,190],[0,190]],'#294b45');
 poly(c,[[0,153],[38,107],[74,128],[100,109],[142,147],[176,106],[209,120],[250,95],[300,147],[300,201],[0,201]],'#203d36');
 for(let i=0;i<22;i++){const x=i*16-12,h=27+rnd()*33,y=145+rnd()*22;rect(c,x+5,y-h,3,h,'#172f2d');for(let k=0;k<4;k++)poly(c,[[x+7,y-h+k*8],[x-6-k,y-h+21+k*8],[x+19+k,y-h+21+k*8]],'#19352e');}
 const tower=(x:number,y:number,w:number,h:number)=>{
  rect(c,x,y,w,h,'#0e2525');rect(c,x+3,y+2,w-5,h-2,'#405b4d');
  for(let a=y+6;a<y+h;a+=9){rect(c,x+3,a,w-5,1,'#253f38');for(let b=x+5+(a%2)*7;b<x+w-3;b+=11)rect(c,b,a-8,1,8,'#304b41');}
  rect(c,x-3,y+3,w+6,5,'#789077');rect(c,x-2,y+h-8,w+4,6,'#536e5a');
  rect(c,x+2,y,5,3,'#99a37a');rect(c,x+w-9,y-2,5,6,'#526e50');
  for(let a=0;a<13;a++){const xx=x+rnd()*w,yy=y+rnd()*h;rect(c,xx,yy,2,4,'#689568');}
 };
 tower(30,76,23,105);tower(246,73,24,107);tower(17,160,32,93);tower(252,156,32,95);
 // Ruined arch framing the raid arena.
 poly(c,[[39,80],[48,59],[62,43],[76,34],[86,31],[82,42],[65,52],[53,67],[51,84]],'#506953');
 poly(c,[[250,80],[242,58],[226,42],[211,34],[203,31],[207,42],[222,52],[236,68],[240,84]],'#506953');
 rect(c,39,80,13,3,'#9aa27a');rect(c,240,80,15,3,'#9aa27a');
 rect(c,0,178,300,202,'#1d322c');
 for(let y=182;y<380;y+=12){for(let x=-20;x<310;x+=28){const xx=x+(y%24?14:0);rect(c,xx,y,26,10,rnd()>.55?'#2e4437':'#293f34');rect(c,xx+1,y,24,1,'#3b5140');if(rnd()>.65)rect(c,xx+4,y+4,8,1,'#364d3d');}}
 poly(c,[[50,173],[247,173],[267,191],[30,191]],'#52684e');rect(c,33,190,234,4,'#152b28');
 rect(c,12,337,278,8,'#4b6047');rect(c,9,347,284,8,'#263c31');rect(c,4,358,293,11,'#344b37');
 for(const x of [19,274]){rect(c,x,183,7,72,'#142d27');rect(c,x-3,251,13,7,'#5d7051');rect(c,x-2,180,11,7,'#b2874b');}
 for(let i=0;i<170;i++){const x=rnd()<.5?rnd()*29:271+rnd()*29,y=165+rnd()*212;rect(c,x,y,2,4+rnd()*5,'#486449');if(rnd()>.6)rect(c,x+2,y-1,2,2,'#84945b');}
 for(const x of [27,272]){rect(c,x-3,147,7,15,'#675941');rect(c,x-5,146,11,3,'#bba06b');}
 return el;
}

export function installArt(scene:Phaser.Scene){
 for(const cls of Object.keys(KITS) as ClassId[])for(let f=0;f<4;f++)scene.textures.addCanvas(`${cls}-${f}`,heroCanvas(cls,f));
 for(let i=0;i<8;i++)scene.textures.addCanvas(`dragon-${i}`,dragon(i));
 scene.textures.addCanvas('ruins',background());
 const {el,c}=canvas(24,24);poly(c,[[4,17],[3,10],[6,5],[18,5],[22,10],[21,18],[16,21],[8,21]],'#192923');poly(c,[[5,15],[6,9],[9,7],[17,8],[19,12],[18,18],[8,18]],'#96b76f');rect(c,7,11,3,3,'#ffe19b');rect(c,15,11,3,3,'#ffe19b');rect(c,10,16,5,2,'#294331');scene.textures.addCanvas('minion',el);
}
