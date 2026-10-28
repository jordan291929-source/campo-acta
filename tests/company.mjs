import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
const output=resolve('.qa/company');await mkdir(output,{recursive:true});
for(const name of ['model','company']){const code=(await readFile(`src/${name}.ts`,'utf8')).replaceAll("from './model'","from './model.mjs'");await writeFile(`${output}/${name}.mjs`,ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);}
const {actaDetails,engineerActaDetails,dateInput,engineerList,findEngineer,engineerRecords,engineerDocument,solesBankDetails,hasDollarBank}=await import(pathToFileURL(`${output}/company.mjs`).href);
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

const registered={...companySigner,engineers:'Ing. Ingeniero Uno | 00000000\nIngeniero Dos | CE-PRUEBA\nIngeniero Antiguo\n'};
assert.deepEqual(engineerList(registered),['Ingeniero Uno','Ingeniero Dos','Ingeniero Antiguo']);
assert.equal(engineerDocument('Ing. INGENIERO UNO',registered),'00000000');assert.equal(engineerDocument('Ingeniero Antiguo',registered),'');assert.equal(engineerDocument('Desconocido',registered),'');
assert.equal(engineerRecords({engineers:'Ingeniero Uno\nIngeniero Uno | 00000000'}).length,1);
assert.equal(engineerDocument('Ingeniero Uno',{engineers:'Ingeniero Uno\nIngeniero Uno | 00000000'}),'00000000');
const autoEngineer=engineerActaDetails({responsible:'Ingeniero Uno'},registered,producer,120,'PEN');assert.equal(autoEngineer.representative_document,'00000000');assert.equal(autoEngineer.authority,'Ingeniero de Campo');
assert.equal(engineerActaDetails({responsible:'Ingeniero Dos'},registered,producer,120,'PEN').representative_document,'CE-PRUEBA');
assert.equal(engineerActaDetails({...autoEngineer,representative_document:'DOCUMENTO-ACTA'},{...registered,engineers:'Ingeniero Uno | OTRO-DOCUMENTO'},producer,120,'PEN').representative_document,'DOCUMENTO-ACTA');
assert.equal(engineerActaDetails({...autoEngineer,representative_document:''},registered,producer,120,'PEN').representative_document,'');
console.log('OK: listado nombre y documento compatible con nombres anteriores; DNI automático y copia guardada del acta conservada.');

const dollarBank={bank:'Banco de prueba · Cuenta Corriente Dólares',account:'CUENTA-USD-PRUEBA'};
assert.equal(hasDollarBank(dollarBank),true);assert.equal(solesBankDetails(dollarBank).account,'');assert.match(solesBankDetails(dollarBank).bank,/Soles/);assert.equal(dollarBank.account,'CUENTA-USD-PRUEBA');
const penBank={bank:'Banco de prueba · Cuenta Corriente Soles',account:'CUENTA-PEN-PRUEBA'};assert.deepEqual(solesBankDetails(penBank),penBank);
for(const bank of ['Cuenta USD','Cuenta en dólares','Cuenta DOLAR','Cuenta US$'])assert.equal(solesBankDetails({bank,account:'CUENTA-USD-PRUEBA'}).account,'');
const transferActa=engineerActaDetails({responsible:'Ingeniero Uno',payment_method:'Efectivo'}, {...registered,...dollarBank},producer,100,'PEN');assert.equal(transferActa.payment_method,'Transferencia');assert.equal(transferActa.account,'');assert.match(transferActa.bank,/Soles/);
assert.equal(engineerActaDetails({responsible:'Ingeniero Uno'}, {...registered,...penBank},producer,100,'PEN').account,'CUENTA-PEN-PRUEBA');
console.log('OK: transferencia predeterminada; cuenta USD nunca se rotula como PEN conservando su número; cuenta PEN válida se mantiene.');
