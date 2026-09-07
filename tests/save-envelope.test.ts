import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSave,saveProfile} from '../src/game/save';
import {createProfile} from '../src/game/profile';
test('incomplete v3 cannot replace legacy progress',()=>{
 const legacy={...createProfile(),version:2,gold:900,cleared:[0],wins:1};
 const values=new Map([['gridbound.v2',JSON.stringify(legacy)],['gridbound.v3','{"version":3}']]);
 const store={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 const loaded=loadSave(store);assert.equal(loaded.readOnly,true);assert.equal(loaded.profile.gold,900);assert.deepEqual(loaded.profile.cleared,[0]);
 assert.throws(()=>saveProfile(store,loaded.profile,loaded.readOnly));assert.equal(values.get('gridbound.v3'),'{"version":3}');
 assert.equal(loadSave({getItem:()=>JSON.stringify(createProfile()),setItem:()=>{}}).readOnly,false);
});
