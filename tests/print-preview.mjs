import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const output=resolve('.qa/print');await mkdir(output,{recursive:true});
for(const name of ['model','company','Acta']){
 const path=`src/${name}.${name==='Acta'?'tsx':'ts'}`;
 const src=(await readFile(path,'utf8')).replaceAll("from './model'","from './model.mjs'").replaceAll("from './company'","from './company.mjs'").replace("import logo from './assets/fruglobe-logo.jpeg';","const logo='../src/assets/fruglobe-logo.jpeg';");
 await writeFile(`${output}/${name}.mjs`,ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText);
}
const {Acta}=await import(pathToFileURL(`${output}/Acta.mjs`).href);
const op={id:'test',number:1,kind:'historical',status:'issued',occurred_on:'2026-10-20',issued_at:'2026-10-26T17:00:00Z',currency:'PEN',warehouse_id:'sur',details:{company_ruc:'00000000000',company_address:'Av. de prueba 123, Distrito de prueba, Perú',company_phone:'000-000000',exchange_rate:'3.381',exchange_rate_date:'2026-10-26',exchange_rate_source:'open.er-api.com',place:'Lugar de prueba',responsible:'Responsable de prueba',campaign:'2026',notes:'Documento de prueba visual. Sin validez operativa.'},producer_snapshot:{name:'Productor de prueba',document:'00000000',predio:'Predio de prueba',details:{location:'Ubicación de prueba'}},total:324.3};
const items=[{product_id:'test',product_name:'Insumo de prueba',presentation:'Envase x 5 L',quantity:3,price:40,unit:'UN'},{product_id:'test-2',product_name:'Insumo en bolsa',presentation:'BOLSA X 5 KG',quantity:2,price:102.15,unit:'UN'}];
const html=renderToStaticMarkup(createElement(Acta,{op,items,warehouses:[{id:'sur',name:'Almacén Sur'}]}));
const css=(await readFile('src/style.css','utf8'))+(await readFile('src/flow.css','utf8'));
await writeFile('.qa/acta.html',`<!DOCTYPE html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acta · Prueba visual</title><style>${css}</style><body>${html}</body></html>`);
console.log('Vista de prueba sintética: /.qa/acta.html');
