export type Details = Record<string,string>;
export type Producer = {id:string;name:string;document:string;predio:string;details:Details};
export type Product = {id:string;name:string;presentation:string;unit:string;package_size:number;sale_price:number;cost_price:number;currency:string};
export type Warehouse = {id:string;name:string;code:string};
export type Stock = {product_id:string;warehouse_id:string;product_name:string;presentation:string;unit:string;warehouse_name:string;quantity:number|null;verified:boolean;as_of:string};
export type Line = {product_id:string;quantity:number;price:number;product_name?:string;presentation?:string;unit?:string};
export type Operation = {id:string;number?:number;kind:string;status:string;warehouse_id:string;destination_id:string|null;producer_id:string|null;occurred_on:string;currency:string;details:Details;version?:number;total?:number;producer_snapshot?:Producer;signed_path?:string;nisira_reference?:string;cancellation_reason?:string;issued_at?:string};
export const kinds:Record<string,string>={delivery:'Entrega a productor',historical:'Regularizar entrega antigua',own_consumption:'Consumo propio · Chincha / campo',transfer:'Transferencia entre almacenes',purchase:'Ingreso de compra'};
export const states:Record<string,string>={draft:'Borrador',issued:'Emitida',signed:'Firmada',cancelled:'Anulada'};
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const fmt=(n:number|string)=>new Intl.NumberFormat('es-PE',{maximumFractionDigits:4}).format(Number(n));
export const money=(n:number|string,currency='USD')=>new Intl.NumberFormat('es-PE',{style:'currency',currency}).format(Number(n));
export const code=(n?:number)=>`ACT-${String(n??0).padStart(6,'0')}`;
export const unit=(s:string)=>s==='UN'?'envase/unidad':s;
export const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();

// Envases y contenido son dos formas de mostrar la misma existencia.
// La equivalencia nunca genera otro movimiento ni cambia precios guardados.
export function presentationContent(presentation:string){
 const text=normalized(presentation).replace(/\bL\s+T\b/g,'LT');
 const match=text.match(/(?:X\s*)?(\d+(?:[.,]\d+)?)\s*(KILOGRAMOS?|KGS?|LITROS?|LTS?|L)\b/);
 if(!match)return null;
 const size=Number(match[1].replace(',','.'));
 return size>0?{size,unit:match[2].startsWith('K')?'KG':'L'}:null;
}
export function stockAmounts(quantity:number|string|null,controlUnit:string,presentation:string,packageSize?:number|string){
 const content=presentationContent(presentation);
 const size=Number(packageSize??content?.size);
 if(quantity===null||!Number.isFinite(Number(quantity))||!Number.isFinite(size)||size<=0)return null;
 const value=Number(quantity);
 if(controlUnit==='UN'&&content)return {packages:value,content:value*size,contentUnit:content.unit};
 if(controlUnit==='L'||controlUnit==='KG')return {packages:value/size,content:value,contentUnit:controlUnit};
 return null;
}
export function equivalentContent(quantity:number|string|null,controlUnit:string,presentation:string,packageSize?:number|string){
 const a=stockAmounts(quantity,controlUnit,presentation,packageSize);
 if(!a)return '';
 return controlUnit==='UN'?`${fmt(a.content)} ${a.contentUnit} en total`:`${fmt(a.packages)} envases equivalentes`;
}
