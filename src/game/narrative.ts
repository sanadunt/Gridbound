export const STORY_CHOICES = [
 {id:'school',chapter:3,title:'Lonceng untuk sekolah',text:'Warga menemukan lonceng kecil di reruntuhan. Ke mana mereka harus membawanya?',options:[{id:'restore',label:'Kembalikan ke sekolah',outcome:'Anak-anak memakai lonceng kecil untuk memanggil waktu makan.'},{id:'memorial',label:'Simpan di taman peringatan',outcome:'Anak-anak belajar nama warga yang hilang di taman peringatan.'}]},
 {id:'archive',chapter:6,title:'Nama di atas tembaga',text:'Sable membawa catatan warga. Ia meminta izin sebelum membuka kisah mereka.',options:[{id:'public',label:'Buka arsip dengan persetujuan warga',outcome:'Sable menjaga arsip publik; setiap warga memilih kisah yang boleh dibaca.'},{id:'private',label:'Kembalikan catatan kepada keluarga',outcome:'Keluarga menyimpan catatan mereka; Sable menjaga daftar tanpa membuka rahasia.'}]},
 {id:'cooperative',chapter:13,title:'Kota tanpa lonceng',text:'Mira mengajak warga membangun perlindungan tanpa mesin. Pekerjaan mana didahulukan?',options:[{id:'clinic',label:'Perkuat klinik bersama',outcome:'Mira dan Lyra membuka klinik yang dikelola bersama warga.'},{id:'routes',label:'Perbaiki jalur air dan pengiriman',outcome:'Mira mengatur koperasi pengiriman; air dan obat tiba tanpa menunggu lonceng.'}]},
] as const;
export function narrativeChoice(state:Record<string,string>,id:string,option:string,cleared:readonly number[]) {
 const scene=STORY_CHOICES.find(s=>s.id===id);
 if(!scene||Object.hasOwn(state,id)||!Array.from({length:scene.chapter},(_,i)=>i).every(i=>cleared.includes(i))||!scene.options.some(o=>o.id===option))return false;
 state[id]=option;return true;
}
export function normalizeNarrative(raw:unknown):Record<string,string>{
 const out:Record<string,string>={};if(!raw||typeof raw!=='object')return out;
 for(const scene of STORY_CHOICES){const value=(raw as Record<string,unknown>)[scene.id];if(scene.options.some(o=>o.id===value))out[scene.id]=value as string;}return out;
}
export function epilogue(state:Record<string,string>,cleared:readonly number[]):string[]{
 if(!Array.from({length:16},(_,i)=>i).every(i=>cleared.includes(i)))return [];
 return ['Mesin berhenti. Vharok bebas. Eda memilih namanya sendiri. Kota membangun perlindungan bersama; mereka tidak mendapatkan kembali semua yang hilang.',...STORY_CHOICES.filter(s=>Object.hasOwn(state,s.id)).map(s=>`${s.title}: ${s.options.find(o=>o.id===state[s.id])!.outcome}`)];
}
