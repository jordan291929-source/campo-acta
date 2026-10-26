import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const output=resolve('.qa/print');await mkdir(output,{recursive:true});
for(const name of ['model','Acta']){
 const path=`src/${name}.${name==='Acta'?'tsx':'ts'}`;
 const src=(await readFile(path,'utf8')).replaceAll("from './model'","from './model.mjs'");
 await writeFile(`${output}/${name}.mjs`,ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText);
}
const {Acta}=await import(pathToFileURL(`${output}/Acta.mjs`).href);
const op={id:'test',number:1,kind:'historical',status:'issued',occurred_on:'2026-10-20',issued_at:'2026-10-26T17:00:00Z',currency:'USD',warehouse_id:'sur',details:{place:'Lugar de prueba',responsible:'Responsable de prueba',campaign:'2026',notes:'Documento de prueba visual. Sin validez operativa.'},producer_snapshot:{name:'Productor de prueba',document:'00000000',predio:'Predio de prueba',details:{location:'Ubicación de prueba'}},total:120};
const items=[{product_id:'test',product_name:'Insumo de prueba',presentation:'Envase x 5 L',quantity:3,price:40,unit:'UN'}];
const html=renderToStaticMarkup(createElement(Acta,{op,items,warehouses:[{id:'sur',name:'Almacén Sur'}]}));
const css=(await readFile('src/style.css','utf8'))+(await readFile('src/flow.css','utf8'));
await writeFile('.qa/acta.html',`<!DOCTYPE html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acta · Prueba visual</title><style>${css}</style><body>${html}</body></html>`);
console.log('Vista de prueba sintética: /.qa/acta.html');
