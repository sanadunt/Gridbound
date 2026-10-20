/** The arena's geometry in canvas px (600×760, the 3×3 hero grid): Phaser-free, so main.ts reads it without loading the engine chunk. */
export const ARENA={width:600,height:760,x:72,y:367,cw:144,ch:112,gap:12};
export function cell(slot:number){return {x:ARENA.x+(slot%3)*(ARENA.cw+ARENA.gap),y:ARENA.y+Math.floor(slot/3)*(ARENA.ch+ARENA.gap)};}
export function center(slot:number){const p=cell(slot);return {x:p.x+72,y:p.y+54};}
