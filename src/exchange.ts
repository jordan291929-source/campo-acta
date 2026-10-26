import {today} from './model';
export type ExchangeRate = {rate:number;date:string;source:string};
export const RATE_SOURCE='open.er-api.com';

// Tipo de cambio referencial USD → PEN (no es el TC oficial SUNAT). Se guarda en cada acta y se puede corregir.
export async function fetchUsdPen():Promise<ExchangeRate>{
 const response=await fetch('https://open.er-api.com/v6/latest/USD');
 const data=response.ok?await response.json() as {result?:string;rates?:Record<string,number>}:{};
 const rate=Number(data.rates?.PEN);
 if(data.result!=='success'||!(rate>0))throw new Error('No se pudo obtener el tipo de cambio de hoy. Ingrésalo manualmente.');
 return {rate:Math.round(rate*1000)/1000,date:today(),source:RATE_SOURCE};
}
export function convertPrice(price:number,from:string,to:string,rate:number){
 if(from===to)return Number(price);
 if(!(rate>0))return 0;
 return Math.round((from==='USD'?price*rate:price/rate)*100)/100;
}
