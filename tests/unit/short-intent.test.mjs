import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveShortIntent} from '../../skills/agrimap-agent-skills/scripts/governance-policy.mjs';

const lastCard={cardId:'c-integration-1',options:[{id:'1',label:'เปิด PR → develop'},{id:'2',label:'แก้ต่อ'},{id:'3',label:'พักไว้'}],expiresAt:new Date(Date.now()+3_600_000).toISOString()};
const cases=[
  ['merge',{intent:'integrate'}],['Merge ครับ',{intent:'integrate'}],['รวมเลย',{intent:'integrate'}],['รวม',{intent:'integrate'}],
  ['รวมเข้า dev',{intent:'integrate',target:'develop'}],['merge into develop',{intent:'integrate',target:'develop'}],['ผ่านแล้ว รวมได้',{intent:'integrate'}],
  ['LGTM',{intent:'integrate'}],['ship it',{intent:'integrate'}],['pr',{intent:'open-pr'}],['MR',{intent:'open-pr'}],['เปิด PR',{intent:'open-pr'}],
  ['ส่งรีวิว',{intent:'open-pr'}],['create pr',{intent:'open-pr'}],['อัปเดต branch',{intent:'update-branch'}],['sync กับ develop',{intent:'update-branch'}],
  ['rebase',{intent:'update-branch'}],['แก้ต่อ',{intent:'continue'}],['ทำต่อนะ',{intent:'continue'}],['พักไว้',{intent:'park'}],['รอก่อน',{intent:'park'}],
  ['ทิ้ง branch',{intent:'abandon'}],['ยกเลิก branch',{intent:'abandon'}],['merge เมื่อ CI ผ่าน',{intent:'integrate',whenGreen:true}],
  ['merge when checks pass',{intent:'integrate',whenGreen:true}],['1',{intent:'select-option',option:'1'}],['ข้อ 3',{intent:'select-option',option:'3'}],
  ['merge ยังไง',{intent:'question'}],['ควร merge ไหม?',{intent:'question'}],['how do I open a pr',{intent:'question'}],['"merge"',{intent:'none'}],
  ['`merge`',{intent:'none'}],['ช่วยสรุปการเปลี่ยนแปลงทั้งหมดของ branch นี้ให้หน่อย แล้วค่อยคิดเรื่อง merge ทีหลังนะครับ ขอบคุณ',{intent:'none'}],
  ['9',{intent:'none'}],['รวมเข้า jenkins',{intent:'integrate',code:'TARGET_IS_RELEASE_FLOW'}],['merge to prod',{intent:'integrate',target:'jenkins-release',code:'TARGET_IS_RELEASE_FLOW'}],
];

test('short integration lexicon (table-driven)',()=>{
  for(const [text,expected] of cases){
    const result=resolveShortIntent(text,{lastCard});
    for(const [key,value] of Object.entries(expected))assert.equal(result[key],value,`${text} → ${key}`);
  }
  assert.ok(cases.length>=30);
});

test('an option number without a stored card is not an action; policy targets are enforced when supplied',()=>{
  assert.equal(resolveShortIntent('1').intent,'none');
  assert.equal(resolveShortIntent('รวมเข้า main',{allowedTargets:['develop']}).code,'TARGET_NOT_ALLOWED');
  assert.equal(resolveShortIntent('รวมเข้า develop',{allowedTargets:['develop']}).code,undefined);
});
