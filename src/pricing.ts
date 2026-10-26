import {normalized,presentationContent,type Product} from './model';
export type InvoicePrice={name:string;aliases?:string[];presentation:string;package_size:number;content_unit:string;currency:string;invoice:string;cost_per_package_net:string;sale_per_package_net:string;cost_per_content_net:string;sale_per_content_net:string};
export type PriceFile={format:'campo-acta-prices-v1';markup_percent:number;tax_included:false;rows:InvoicePrice[]};
export function readPriceFile(value:unknown):PriceFile{
 const p=value as PriceFile;
 if(!p||p.format!=='campo-acta-prices-v1'||p.tax_included!==false||p.markup_percent!==15||!Array.isArray(p.rows)||!p.rows.length)throw new Error('Selecciona el archivo de precios preparado para Campo Acta (sin IGV, +15%).');
 const keys=new Set<string>();
 for(const r of p.rows){
  if(typeof r.name!=='string'||!r.name.trim()||typeof r.presentation!=='string'||!r.presentation.trim()||r.currency!=='USD'||!['L','KG'].includes(r.content_unit)||!Number.isFinite(Number(r.package_size))||r.package_size<=0)throw new Error('El archivo contiene un producto incompleto.');
  for(const field of ['cost_per_package_net','sale_per_package_net','cost_per_content_net','sale_per_content_net'] as const)if(!Number.isFinite(Number(r[field]))||Number(r[field])<=0)throw new Error(`Precio inválido: ${r.name}`);
  if(Math.abs(Number(r.sale_per_package_net)-Number(r.cost_per_package_net)*1.15)>0.00011||Math.abs(Number(r.sale_per_content_net)-Number(r.cost_per_content_net)*1.15)>0.0002)throw new Error(`El aumento no coincide con 15%: ${r.name}`);
  const key=normalized(r.name)+'|'+r.package_size;if(keys.has(key))throw new Error('Hay productos repetidos en el archivo.');keys.add(key);
 }
 return p;
}
export function planPrice(row:InvoicePrice,products:Product[]){
 const names=[row.name,...(row.aliases??[])].map(normalized);
 const byName=products.filter(p=>names.includes(normalized(p.name)));
 const matches=byName.filter(p=>Number(p.package_size)===Number(row.package_size)&&presentationContent(p.presentation)?.unit===row.content_unit);
 if(matches.length>1)throw new Error(`Hay varias presentaciones equivalentes de ${row.name}. Revisa el catálogo antes de actualizar.`);
 if(byName.length&&!matches.length)throw new Error(`La presentación de ${row.name} no coincide con la factura (${row.package_size} ${row.content_unit}).`);
 const existing=matches[0];const control=existing?.unit??'UN';
 if(control!=='UN'&&control!==row.content_unit)throw new Error(`Unidad incompatible para ${row.name}.`);
 return {...(existing??{name:row.name,presentation:row.presentation,unit:'UN',package_size:row.package_size}),currency:row.currency,cost_price:Number(control==='UN'?row.cost_per_package_net:row.cost_per_content_net),sale_price:Number(control==='UN'?row.sale_per_package_net:row.sale_per_content_net)};
}
