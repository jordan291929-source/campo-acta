import {today} from './model';
export type ExchangeRate = {rate:number;date:string;source:string};
const LAST_RATE='campo-acta:last-usd-pen';

// Tipo de cambio referencial USD → PEN (no es el TC oficial SUNAT). Se guarda en cada acta y se puede corregir.
// Se prueban dos fuentes públicas; si ambas fallan se usa el último TC obtenido en este navegador.
const sources:[string,string,(data:any)=>unknown][]=[
 ['open.er-api.com','https://open.er-api.com/v6/latest/USD',data=>data?.result==='success'&&data.rates?.PEN],
 ['currency-api','https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',data=>data?.usd?.pen],
];
export async function fetchUsdPen():Promise<ExchangeRate>{
 for(const [source,url,pick] of sources){
  try{
   const response=await fetch(url,{cache:'no-store'});
   const rate=Number(response.ok?pick(await response.json()):0);
   if(rate>2&&rate<6){
    const result={rate:Math.round(rate*1000)/1000,date:today(),source};
    try{localStorage.setItem(LAST_RATE,JSON.stringify(result));}catch{/* sin almacenamiento local */}
    return result;
   }
  }catch{/* siguiente fuente */}
 }
 try{
  const last=JSON.parse(localStorage.getItem(LAST_RATE)??'null') as ExchangeRate|null;
  if(last&&last.rate>0)return {...last,source:`último TC disponible (${last.source})`};
 }catch{/* sin almacenamiento local */}
 throw new Error('No se pudo obtener el tipo de cambio de hoy. Ingrésalo manualmente.');
}
export function convertPrice(price:number,from:string,to:string,rate:number){
 if(from===to)return Number(price);
 if(!(rate>0))return 0;
 return Math.round((from==='USD'?price*rate:price/rate)*100)/100;
}
