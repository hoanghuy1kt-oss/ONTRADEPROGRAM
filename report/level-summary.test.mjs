import assert from 'node:assert/strict';
import {summarizeLevels} from './level-summary.mjs';
const rows=[
 {level:'A',onList:true,targetTotal:200,plan:100,amount:50000000},
 {level:'A',onList:true,targetTotal:800,plan:400,amount:400000000},
 {level:'B',onList:true,targetTotal:100,plan:0,amount:0},
 {level:'',onList:false,targetTotal:0,plan:null,amount:10000000},
];
const summary=summarizeLevels(rows);
assert.deepEqual(summary.levels.map(r=>r.level),['A','B','—']);
assert.equal(summary.levels[0].cumulativeAchievement,0.9);
assert.equal(summary.levels[0].totalAchievement,0.45);
assert.equal(summary.levels[0].totalTarget,1000000000);
assert.equal(summary.levels[1].cumulativeAchievement,null);
assert.equal(summary.levels[2].totalTarget,null);
assert.equal(summary.total.revenue,460000000);
assert.equal(summary.total.totalTarget,1100000000);
assert.equal(summary.total.cumulativeTarget,500000000);
assert.equal(summary.total.cumulativeAchievement,0.92);
assert.equal(summarizeLevels(rows.filter(r=>r.level==='A')).total.revenue,450000000);
assert.deepEqual(summarizeLevels([]).levels,[]);
assert.equal(summarizeLevels([]).total.totalAchievement,null);
console.log('Level summary assertions passed: weighted ratios, VND conversion, zero targets, missing Level, totals and filtered rows.');

assert.deepEqual(summary.levels.map(r=>r.outletCount),[2,1,1]);
assert.equal(summary.total.outletCount,4);
assert.equal(summarizeLevels(rows.filter(r=>r.level==='A')).total.outletCount,2);
assert.equal(summarizeLevels([]).total.outletCount,0);
console.log('Outlet counts passed: each Level, total, filters and empty data.');
