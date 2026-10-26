import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
const output=resolve('.qa/pricing');await mkdir(output,{recursive:true});
for(const name of ['model','pricing']){const source=(await readFile(`src/${name}.ts`,'utf8')).replace("from './model'","from './model.mjs'");await writeFile(`${output}/${name}.mjs`,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);}
const {readPriceFile,planPrice}=await import(pathToFileURL(`${output}/pricing.mjs`).href);
const row={name:'Insumo de prueba',presentation:'ENVASE X 20 LT',package_size:20,content_unit:'L',currency:'USD',invoice:'PRUEBA',cost_per_package_net:'120',sale_per_package_net:'138',cost_per_content_net:'6',sale_per_content_net:'6.9'};
const file={format:'campo-acta-prices-v1',markup_percent:15,tax_included:false,rows:[row]};
assert.equal(readPriceFile(file).rows.length,1);
assert.equal(planPrice(row,[]).sale_price,138);
const product={id:'test',name:row.name,presentation:row.presentation,package_size:20,unit:'L',currency:'USD',sale_price:0,cost_price:0};
assert.equal(planPrice(row,[product]).sale_price,6.9);
assert.equal(planPrice(row,[{...product,unit:'UN'}]).cost_price,120);
assert.throws(()=>readPriceFile({...file,tax_included:true}),/sin IGV/);
assert.throws(()=>readPriceFile({...file,rows:[{...row,sale_per_package_net:'150'}]}),/15%/);
assert.throws(()=>planPrice(row,[{...product,package_size:5,presentation:'ENVASE X 5 L'}]),/presentación/);
assert.throws(()=>planPrice(row,[product,{...product,id:'duplicado'}]),/varias/);
for(const path of process.argv.slice(2)){const actual=readPriceFile(JSON.parse(await readFile(path,'utf8')));assert.equal(actual.rows.length,16);for(const r of actual.rows){assert.ok(planPrice(r,[]).sale_price>0);}console.log(`Archivo privado validado: ${actual.rows.length} productos.`);}
console.log('OK: margen 15% sin IGV, precio por envase/L, rechazo de duplicados y presentaciones distintas.');
