import { CAMPAIGN } from './world';
/**
 * Story choices open once chapters 0..chapter-1 are cleared and are offered when the camp opens after that clear.
 * `line` is the sentence of the final chapter's outro this choice can change; an option's `line` replaces it (storyOutro).
 */
type Choice={id:string;chapter:number;title:string;text:string;line?:string;options:readonly {id:string;label:string;outcome:string;line?:string}[]};
export const STORY_CHOICES:readonly Choice[] = [
 {id:'school',chapter:13,title:'Lonceng untuk sekolah',text:'Kestrel menemukan lonceng kecil di reruntuhan Blackbriar. Ke mana warga membawanya?',options:[{id:'restore',label:'Gantung di sekolah yang kosong',outcome:'Lonceng dipasang di sekolah yang kosong; tak seorang pun ingat mengapa kursinya kecil.'},{id:'memorial',label:'Simpan di taman peringatan',outcome:'Lonceng disimpan di taman peringatan untuk nama-nama yang belum kembali.'}]},
 {id:'archive',chapter:6,title:'Nama di atas tembaga',text:'Sable membawa catatan warga. Ia meminta izin sebelum membuka kisah mereka.',line:'Sable menjaga arsip agar tidak ada kontrak yang disembunyikan.',options:[{id:'public',label:'Buka arsip dengan persetujuan warga',outcome:'Sable menjaga arsip publik; setiap warga memilih kisah yang boleh dibaca.'},{id:'private',label:'Kembalikan catatan kepada keluarga',outcome:'Keluarga menyimpan catatan mereka; Sable menjaga daftar tanpa membuka rahasia.',line:'Sable menjaga daftar yang tidak pernah ia buka.'}]},
 {id:'cooperative',chapter:13,title:'Kota tanpa lonceng',text:'Mira dan Hale mengajak warga membangun perlindungan tanpa mesin. Pekerjaan mana didahulukan?',line:'Lyra membuka klinik atas namanya sendiri.',options:[{id:'clinic',label:'Perkuat klinik bersama',outcome:'Mira dan Lyra membuka klinik yang dikelola bersama warga.',line:'Lyra membuka klinik bersama Mira dan warga, bukan atas namanya sendiri saja.'},{id:'routes',label:'Perbaiki jalur air dan pengiriman',outcome:'Hale dan Mira mengatur koperasi pengiriman; air dan obat tiba tanpa menunggu lonceng.'}]},
];
/** A choice is open once every chapter before its gate is cleared. */
export const choiceOpen=(scene:Choice,cleared:readonly number[])=>Array.from({length:scene.chapter},(_,i)=>i).every(i=>cleared.includes(i));
/** Choices the player may still make: open and not yet answered. */
export const pendingChoices=(state:Record<string,string>,cleared:readonly number[])=>STORY_CHOICES.filter(s=>choiceOpen(s,cleared)&&!Object.hasOwn(state,s.id));
/** Whether clearing chapter `index` (0-based) owes a camp scene: a story choice it opens, or the finale. */
export const chapterHasScene=(index:number)=>index===CAMPAIGN.length-1||STORY_CHOICES.some(s=>s.chapter===index+1);
/** A chapter's outro; in the finale, the sentences a story choice changes follow that choice. */
export function storyOutro(index:number,state:Record<string,string>):string{
 let text=CAMPAIGN[index]?.outro??'';
 if(index!==CAMPAIGN.length-1)return text;
 for(const s of STORY_CHOICES){const line=s.options.find(o=>o.id===state[s.id])?.line;if(s.line&&line)text=text.replace(s.line,line);}
 return text;
}
export function narrativeChoice(state:Record<string,string>,id:string,option:string,cleared:readonly number[]) {
 const scene=STORY_CHOICES.find(s=>s.id===id);
 if(!scene||Object.hasOwn(state,id)||!choiceOpen(scene,cleared)||!scene.options.some(o=>o.id===option))return false;
 state[id]=option;return true;
}
export function normalizeNarrative(raw:unknown):Record<string,string>{
 const out:Record<string,string>={};if(!raw||typeof raw!=='object')return out;
 for(const scene of STORY_CHOICES){const value=(raw as Record<string,unknown>)[scene.id];if(scene.options.some(o=>o.id===value))out[scene.id]=value as string;}return out;
}
/** The choice outcomes once the campaign is cleared (the lead line is the UI string journal.epilogue.lead). */
export function epilogue(state:Record<string,string>,cleared:readonly number[]):string[]{
 if(!CAMPAIGN.every((_,i)=>cleared.includes(i)))return [];
 return STORY_CHOICES.filter(s=>Object.hasOwn(state,s.id)).map(s=>`${s.title}: ${s.options.find(o=>o.id===state[s.id])!.outcome}`);
}
