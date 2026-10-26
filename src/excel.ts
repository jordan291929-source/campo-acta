import {normalized,type Details} from './model';
export type ImportStock={name:string;presentation:string;warehouse:string;quantity:number|null;unit:string;package_size:number;notes:string};
export type HistoryGroup={key:string;date:string;warehouse:string;description:string;responsible:string;items:{name:string;quantity:number;sourceUnit:string}[]};
const text=(v:unknown):string=>{if(v==null)return '';if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==='object'){const x=v as {result?:unknown;text?:string;richText?:{text:string}[];error?:string};if(x.error)return '';if('result'in x)return text(x.result);if(x.richText)return x.richText.map(v=>v.text).join('');return x.text??'';}return String(v).trim();};
const quantity=(v:unknown)=>{const n=Number(text(v));return text(v)!==''&&Number.isFinite(n)?n:null;};
export async function readExcel(file:File){
 const module=await import('exceljs');const Excel=(module as unknown as {default?:typeof import('exceljs')}).default??module;
 const workbook=new Excel.Workbook();await workbook.xlsx.load(await file.arrayBuffer());
 const stock:ImportStock[]=[];const groups=new Map<string,HistoryGroup>();const producers=new Map<string,{name:string;document:string;predio:string;details:Details}>();
 workbook.eachSheet(sheet=>{
  if(normalized(sheet.name)==='PRODUCTOS')sheet.eachRow((row,i)=>{
   if(i<3||!text(row.getCell(1).value))return;
   const name=text(row.getCell(2).value),presentation=text(row.getCell(3).value),wh=normalized(text(row.getCell(5).value));
   if(!name||(!wh.includes('SUR')&&!wh.includes('NORTE')))return;
   const size=Number(presentation.match(/X\s*(\d+(?:[.,]\d+)?)/i)?.[1]?.replace(',','.'))||1;
   stock.push({name,presentation,warehouse:wh.includes('SUR')?'SUR':'NORTE',quantity:quantity(row.getCell(8).value),unit:'',package_size:size,notes:`${file.name} · Productos fila ${i} · Código interno ${text(row.getCell(1).value)} · Unidad declarada ${text(row.getCell(6).value)}`});
  });
  if(normalized(sheet.name)==='REGISTRO DE MOVIMIENTOS')sheet.eachRow((row,i)=>{
   const q=quantity(row.getCell(8).value),desc=text(row.getCell(9).value),date=text(row.getCell(1).value),wh=normalized(text(row.getCell(5).value));
   if(i<3||q===null||q>=0||normalized(desc).includes('TRASLADO'))return;
   const warehouse=wh.includes('SUR')?'SUR':'NORTE',key=`${date}|${warehouse}|${normalized(desc)}`;
   if(!groups.has(key))groups.set(key,{key,date,warehouse,description:desc,responsible:text(row.getCell(11).value),items:[]});
   groups.get(key)!.items.push({name:text(row.getCell(3).value),quantity:-q,sourceUnit:text(row.getCell(6).value)});
  });
  let headers:Record<string,number>={};
  sheet.eachRow(row=>{
   const cells:Record<string,number>={};row.eachCell((c,col)=>{cells[normalized(text(c.value))]=col;});
   if('PRODUCTOR /FUNDO'in cells){headers=cells;return;}
   if(!headers['PRODUCTOR /FUNDO'])return;
   const get=(h:string)=>headers[h]?text(row.getCell(headers[h]).value):'';
   const name=get('PRODUCTOR /FUNDO'),document=get('DNI'),predio=get('CLP PREDIO');if(!name||['TOTAL','TOTALES'].includes(normalized(name))||!/[a-záéíóúñ]/i.test(name))return;
   const key=`${normalized(name)}|${document}|${predio}`;
   if(!producers.has(key))producers.set(key,{name,document,predio,details:{location:[get('DEPARTAMENTO'),get('DISTRITO'),get('SECTOR/ZONA')].filter(Boolean).join(' / '),responsible:get('ING. RESPONSABLE'),source:file.name}});
  });
 });
 const allProducers=[...producers.values()];
 return {stock,history:[...groups.values()],producers:allProducers.filter(p=>p.document||!allProducers.some(r=>r.document&&normalized(r.name)===normalized(p.name)))};
}
