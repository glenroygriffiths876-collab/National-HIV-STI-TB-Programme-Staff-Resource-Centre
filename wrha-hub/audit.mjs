/**
 * WRHA Manual & Resource Hub — static catalogue and UI audit.
 * Usage: node wrha-hub/audit.mjs
 * This DOES NOT prove remote PDF availability, full facility coverage, PDF iframe
 * embedding, institutional approval, or browser/mobile visual compatibility.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=(n)=>fs.readFileSync(path.join(here,n),'utf8');
let errors=[];
function check(condition,message){if(!condition)errors.push(message);}
for(const file of ['app.js','data.js']){
  try{execFileSync(process.execPath,['--check',path.join(here,file)],{stdio:'pipe'});}
  catch(err){errors.push(file+' has a JS syntax error: '+String(err.stderr||err.message).slice(0,400));}
}
const bag={};vm.runInNewContext(read('data.js'),{window:bag}, {timeout:2000});
const d=bag.WRHA_DATA;
check(!!d,'Catalogue missing');
if(d){
  check(d.manuals.length>0,'Manual catalogue empty');
  check(Object.keys(d.rhaMap).length===14,'Missing parish coverage selector');
  check(d.roleGroups.length>=4,'Role groups missing');
  check(d.facilities.length>0,'Health-centre directory empty');
  let manualIds=new Set(),facilityIds=new Set(),facilityNames=new Set();
  for(const m of d.manuals){
    check(!manualIds.has(m.id),'Duplicate manual ID: '+m.id);
    manualIds.add(m.id);
    check(!!(m.title&&m.category&&m.url),'Incomplete manual metadata: '+m.id);
    if(m.local)check(fs.existsSync(path.resolve(here,m.url)),'Missing local PDF: '+m.url);
    else {try{new URL(m.url);}catch{errors.push('Invalid external URL: '+m.id)}}
  }
  for(const f of d.facilities){
    check(!facilityIds.has(f.id),'Duplicate facility ID: '+f.id);
    facilityIds.add(f.id);
    check(Object.hasOwn(d.rhaMap,f.parish),'Unknown parish: '+f.parish);
    check(d.rhaMap[f.parish]===f.rha,'Wrong RHA: '+f.name);
    const k=f.parish+'|'+f.name.toLowerCase().replace(/[\s-]/g,'');
    check(!facilityNames.has(k),'Duplicate facility entry: '+k);
    facilityNames.add(k);
    check(!!f.source,'Missing facility source: '+f.name);
  }
}
const html=read('index.html'),app=read('app.js');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
for(const ref of app.matchAll(/\$\('([^']+)'\)/g))check(ids.has(ref[1]),'Missing DOM ID used by JS: '+ref[1]);
check(html.includes('wrha-logo.webp'),'Official logo is not linked in preview');
check(fs.existsSync(path.join(here,'wrha-logo.webp')),'Logo asset missing');
const courses=['WRHA-NCD-Adherence-Counselling-Academy','JASDIS-STUDY-HUB'];
for(const target of courses)check(html.includes(target),'Missing approved training link: '+target);
check(!/JASON\s*(?:bot|prep)/i.test(html),'Legacy JASON bot UI still present');
check(html.includes('https://www.wrha.gov.jm/'),'WRHA official link absent');
check(html.includes('https://www.moh.gov.jm/'),'MOHW source link absent');
check(fs.existsSync(path.join(root,'legacy','index.html')),'Legacy source rollback copy missing (only required in staging branch)');
if(errors.length){console.error('WRHA STATIC AUDIT FAILED');errors.forEach(x=>console.error(' - '+x));process.exit(1)}
console.log('WRHA STATIC AUDIT PASSED');
console.log(JSON.stringify({manuals:d.manuals.length,localPDFs:d.manuals.filter(x=>x.local).length,externalManualLinks:d.manuals.filter(x=>!x.local).length,facilities:d.facilities.length,parishes:Object.keys(d.rhaMap).length,roles:d.roleGroups.reduce((n,g)=>n+g.roles.length,0)},null,2));
console.log('NOTE: Visual tests, live external URLs, PDF embedding and directory completeness require separate review.');
