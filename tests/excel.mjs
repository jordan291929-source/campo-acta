import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
const output=resolve('.qa/excel');await mkdir(output,{recursive:true});
try{
 for(const name of ['model','excel']){
  const src=(await readFile(`src/${name}.ts`,'utf8')).replace("from './model'","from './model.mjs'");
  await writeFile(`${output}/${name}.mjs`,ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 }
 const {readExcel}=await import(pathToFileURL(`${output}/excel.mjs`).href);
 for(const path of process.argv.slice(2)){
  const file=new File([await readFile(path)],basename(path));const result=await readExcel(file);
  if(result.stock.length){assert.equal(result.stock.length,32);assert.equal(result.history.length,5);assert.ok(result.stock.every(s=>s.unit===''));assert.ok(result.history.every(g=>!g.description.toUpperCase().includes('TRASLADO')));}
  if(result.producers.length){assert.ok(result.producers.every(p=>p.name));assert.ok(result.producers.some(p=>p.document));}
  console.log(JSON.stringify({file:basename(path),stock:result.stock.length,historyGroups:result.history.length,producers:result.producers.length}));
 }
}finally{await rm(output,{recursive:true,force:true});}
