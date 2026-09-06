import { writeFileSync,mkdirSync } from 'node:fs';
import { KITS } from '../src/game/content';
import { CHARACTERS } from '../src/game/characters';
import { JOBS,GEAR } from '../src/game/jobs';
import { CAMPAIGN,ENEMIES,BOONS } from '../src/game/world';
import { TALENTS } from '../src/game/profile';
const database={schemaVersion:3,title:'Gridbound: Ashes of the Bell',characters:CHARACTERS,basicJobs:KITS,advancedJobs:JOBS,talents:TALENTS,equipment:GEAR,monsters:ENEMIES,boons:BOONS,campaign:CAMPAIGN.map((chapter,i)=>({...chapter,number:i+1,act:Math.floor(i/4)+1,stages:chapter.stages.map(s=>({...s,combatHp:Math.round(s.hp*(i<4?2.2:4+(i+1)*.75))}))}))};
mkdirSync('data',{recursive:true});writeFileSync('data/database.json',JSON.stringify(database,null,2)+'\n');
console.log(JSON.stringify({characters:CHARACTERS.length,basicJobs:Object.keys(KITS).length,advanced:Object.values(JOBS).filter(j=>j.tier===2).length,third:Object.values(JOBS).filter(j=>j.tier===3).length,skills:Object.values(KITS).reduce((sum,k)=>sum+k.skills.length,0),talents:TALENTS.length,gear:GEAR.length,monsters:Object.keys(ENEMIES).length,boons:BOONS.length,chapters:CAMPAIGN.length,encounters:CAMPAIGN.reduce((sum,c)=>sum+c.stages.length,0)}));
