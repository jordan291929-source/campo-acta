import type {Product,Stock} from './model';
import {convertPrice} from './exchange';
export const FAMILIES:Record<string,string>={agrochemical:'Agroquímico',oil:'Aceite',fertilizer:'Fertilizante',unclassified:'Sin clasificar'};
export const familyOf=(p?:Product)=>p?.family&&p.family in FAMILIES?p.family:'unclassified';
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
// Costo de catálogo sin IGV, por unidad de control. Nunca usa el precio con margen.
export function stockValue(s:Stock,p:Product|undefined,currency:string,rate:number):number|null{
 if(s.quantity===null||!Number.isFinite(Number(s.quantity))||Number(s.quantity)<0)return null;
 if(Number(s.quantity)===0)return 0;
 if(!p||p.unit!==s.unit||!(Number(p.cost_price)>0)||!Number.isFinite(Number(p.cost_price))||!['USD','PEN'].includes(p.currency))return null;
 if(p.currency!==currency&&!(rate>0))return null;
 return cents(convertPrice(Number(s.quantity)*Number(p.cost_price),p.currency,currency,rate));
}
export function inventoryTotals(rows:Stock[],products:Product[],rate:number){
 let usd=0,pen=0,usdMissing=0,penMissing=0;
 for(const s of rows){const p=products.find(p=>p.id===s.product_id),u=stockValue(s,p,'USD',rate),v=stockValue(s,p,'PEN',rate);if(u===null)usdMissing++;else usd+=u;if(v===null)penMissing++;else pen+=v;}
 return {usd:cents(usd),pen:cents(pen),usdMissing,penMissing};
}
