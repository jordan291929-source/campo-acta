import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
const out=resolve('.qa/producers-module');await mkdir(out,{recursive:true});
for(const name of ['model','excel']){const source=(await readFile(`src/${name}.ts`,'utf8')).replace("from './model'","from './model.mjs'");await writeFile(`${out}/${name}.mjs`,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);}
const {readExcel}=await import(pathToFileURL(`${out}/excel.mjs`).href);
const read=async p=>readExcel(new File([await readFile(p)],basename(p)));
const blank=await read(process.argv[2]);assert.equal(blank.producers.length,0,'Los ejemplos y las filas vacías no deben importarse');
const sample=await read(process.argv[3]);assert.equal(sample.producers.length,2);
assert.equal(sample.producers[0].document,'00123456');assert.equal(sample.producers[0].details.phone,'099900000');assert.equal(sample.producers[0].details.email,'productor@example.com');assert.equal(sample.producers[0].details.address,'Dirección de prueba');
assert.equal(sample.producers[1].document,'20123456789');assert.equal(sample.producers[1].details.ruc,'20123456789');
console.log('OK: plantilla vacía sin registros ficticios, importación de contacto/domicilio, DNI con cero inicial y empresa con RUC sin DNI.');
