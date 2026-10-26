import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
const output=resolve('.qa/company');await mkdir(output,{recursive:true});
for(const name of ['model','company']){const code=(await readFile(`src/${name}.ts`,'utf8')).replaceAll("from './model'","from './model.mjs'");await writeFile(`${output}/${name}.mjs`,ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);}
const {actaDetails,engineerActaDetails,dateInput,engineerList,findEngineer}=await import(pathToFileURL(`${output}/company.mjs`).href);
const DEFAULT_COMPANY={company_address:'Dirección de prueba',company_ruc:'00000000000'};
const producer={id:'p1',name:'Productor de prueba',document:'00123456',predio:'Predio',details:{}};
const draft=actaDetails({responsible:'Campo'},DEFAULT_COMPANY,producer,120,'USD');
assert.equal(draft.company_address,DEFAULT_COMPANY.company_address);assert.equal(draft.receiver,producer.name);assert.equal(draft.receiver_document,'00123456');assert.equal(draft.receiver_mode,'producer');assert.equal(draft.initial_debt_mode,'auto');
const updated=actaDetails(draft,DEFAULT_COMPANY,{...producer,name:'Otro productor',document:'12345678'},240,'USD');assert.equal(updated.receiver,'Otro productor');assert.notEqual(updated.initial_debt,draft.initial_debt);
const other=actaDetails({receiver_mode:'other',receiver:'Receptor de prueba',receiver_document:'87654321'},DEFAULT_COMPANY,producer,120,'USD');assert.equal(other.receiver,'Receptor de prueba');
const legacy=actaDetails({receiver:'Otro receptor',initial_debt:'Importe pactado',company_address:'Dirección guardada'},DEFAULT_COMPANY,producer,120,'USD');assert.equal(legacy.receiver_mode,'other');assert.equal(legacy.initial_debt,'Importe pactado');assert.equal(legacy.company_address,'Dirección guardada');
assert.equal(dateInput('21/10/2026'),'2026-10-21');assert.equal(dateInput(''),'');assert.equal(draft.bank,undefined);assert.equal(draft.representative_document,undefined);assert.equal(draft.due_date,undefined);
const names=engineerList({engineers:'Ing. Ingeniero Uno\nIngeniero Dos\nIngeniero Uno\n'});assert.deepEqual(names,['Ingeniero Uno','Ingeniero Dos']);assert.equal(findEngineer('Ing. ingeniero uno',names),'Ingeniero Uno');assert.equal(findEngineer('usuario@example.com',names),undefined);assert.deepEqual(engineerList({}),[]);
console.log('OK: empresa y productor automáticos, receptor alternativo, deuda recalculada, borradores previos conservados y sin inventar DNI, cuentas o fechas.');

const companySigner={...DEFAULT_COMPANY,representative_name:'Representante general',representative_document:'DOCUMENTO-EMPRESA',authority:'Gerente General'};
const fieldActa=engineerActaDetails({responsible:'Ingeniero de prueba'},companySigner,producer,120,'PEN');
assert.equal(fieldActa.representative_name,'Ingeniero de prueba');assert.equal(fieldActa.representative_document,'');assert.equal(fieldActa.authority,'Ingeniero de Campo');
const completed=engineerActaDetails({...fieldActa,representative_document:'DOCUMENTO-PRUEBA'},companySigner,producer,240,'PEN');
assert.equal(completed.representative_document,'DOCUMENTO-PRUEBA');assert.equal(completed.authority,'Ingeniero de Campo');
assert.equal(engineerActaDetails({...completed,authority:'Cargo acordado'},companySigner,producer,240,'PEN').authority,'Cargo acordado');
assert.equal(actaDetails({},companySigner,undefined,0,'PEN').authority,'Gerente General');assert.equal(companySigner.representative_document,'DOCUMENTO-EMPRESA');
console.log('OK: DNI y cargo propios del ingeniero en el acta, sin heredar ni cambiar el firmante general.');
