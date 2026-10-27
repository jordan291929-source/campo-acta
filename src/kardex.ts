import type {Operation,Product,Producer,Warehouse} from './model';
import {normalized,states} from './model';
import {FAMILIES,familyOf} from './inventory';
export type Movement={id:string;operation_id:string;product_id:string;warehouse_id:string;quantity_delta:number|string;movement_type:string;occurred_on:string;reference:string;created_by:string;created_at:string};
export type Opening={product_id:string;warehouse_id:string;quantity:number|string|null;as_of:string;verified:boolean;source_reference:string;created_at:string};
export type Profile={id:string;full_name:string};
export type Audit={id:string;operation_id:string|null;actor:string;action:string;created_at:string;details?:Record<string,unknown>};
export type LedgerRow={id:string;date:string;registeredAt:string;productId:string;productName:string;presentation:string;unit:string;family:string;warehouseId:string;warehouseName:string;kind:string;typeLabel:string;delta:number|null;direction:string;before:number|null;balance:number|null;balanceNote:string;origin:string;destination:string;actorId:string;actor:string;responsible:string;reference:string;operation?:Operation;reversal:boolean;source:string};
export const MOVEMENT_KINDS:Record<string,string>={opening:'Saldo inicial',purchase:'Ingreso de compra',producer_delivery:'Entrega a productor',transfer:'Traslado',own_consumption:'Consumo propio',reversal:'Anulación / reverso',adjustment:'Ajuste'};
export const AUDIT_ACTIONS:Record<string,string>={stock_initial:'Carga inicial',set_initial:'Corrección de saldo inicial',save_draft:'Guardó borrador',issue:'Emitió documento',cancel:'Anuló documento',followup:'Actualizó firma / NISIRA',delete:'Eliminó documento',delete_product:'Eliminó producto'};
export const actorName=(id:string,profiles:Profile[])=>profiles.find(p=>p.id===id)?.full_name||(id?`Cuenta ${id.slice(0,8)}`:'Sin registro');
const rounded=(n:number)=>Math.round((n+Number.EPSILON)*10000)/10000;
const compare=(a:{date:string;registeredAt:string;id:string},b:{date:string;registeredAt:string;id:string})=>a.date.localeCompare(b.date)||a.registeredAt.localeCompare(b.registeredAt)||a.id.localeCompare(b.id);
export function buildLedger(movements:Movement[],openings:Opening[],products:Product[],warehouses:Warehouse[],operations:Operation[],profiles:Profile[],audit:Audit[],producers:Producer[]=[]){
 const rows:LedgerRow[]=[],pairs=new Map<string,LedgerRow[]>(),openingMap=new Map(openings.map(o=>[`${o.product_id}:${o.warehouse_id}`,o]));
 const warehouse=(id:string|null)=>warehouses.find(w=>w.id===id)?.name||'Almacén sin dato';
 for(const m of movements){
  const p=products.find(p=>p.id===m.product_id),cancel=audit.find(a=>a.action==='cancel'&&a.details?.reversal_id===m.operation_id);
  const referenceNumber=m.reference?.match(/ACT-(\d+)/)?.[1];
  const op=operations.find(o=>o.id===(cancel?.operation_id||m.operation_id))||operations.find(o=>referenceNumber&&o.number===Number(referenceNumber));
  const reversal=!!cancel||/^Anulaci[oó]n\s+ACT-/i.test(m.reference),kind=reversal?'reversal':m.movement_type;
  const producer=op?.producer_snapshot||producers.find(p=>p.id===op?.producer_id);
  let origin=warehouse(op?.warehouse_id||m.warehouse_id),destination=op?.kind==='transfer'?warehouse(op.destination_id):op?.kind==='delivery'?producer?.name||'Productor sin dato':op?.details.destination||'Destino sin dato';
  if(op?.kind==='purchase'||m.movement_type==='purchase'){origin=op?.details.destination||'Proveedor sin dato';destination=warehouse(op?.warehouse_id||m.warehouse_id);}
  if(!op&&m.movement_type==='transfer'){origin='Origen sin documento';destination='Destino sin documento';}
  if(reversal)[origin,destination]=[destination,origin];
  const row:LedgerRow={id:m.id,date:m.occurred_on,registeredAt:m.created_at,productId:m.product_id,productName:p?.name||'Producto sin dato',presentation:p?.presentation||'',unit:p?.unit||'',family:familyOf(p),warehouseId:m.warehouse_id,warehouseName:warehouse(m.warehouse_id),kind,typeLabel:MOVEMENT_KINDS[kind]||kind,delta:Number.isFinite(Number(m.quantity_delta))?Number(m.quantity_delta):null,direction:Number(m.quantity_delta)>0?'in':'out',before:null,balance:null,balanceNote:'',origin,destination,actorId:m.created_by,actor:actorName(m.created_by,profiles),responsible:op?.details.responsible||'',reference:m.reference||'',operation:op,reversal,source:''};
  const key=`${m.product_id}:${m.warehouse_id}`;pairs.set(key,[...(pairs.get(key)||[]),row]);rows.push(row);
 }
 for(const [key,group]of pairs){
  const initial=openingMap.get(key),invalidCut=!!initial&&group.some(m=>m.date<initial.as_of);
  let balance=initial&&initial.quantity!==null&&Number.isFinite(Number(initial.quantity))&&!invalidCut?Number(initial.quantity):null;
  group.sort(compare);
  for(const row of group){row.before=balance;balance=balance!==null&&row.delta!==null?rounded(balance+row.delta):null;row.balance=balance;row.balanceNote=invalidCut?'Hay registros anteriores al corte inicial; saldo pendiente de conciliar':!initial?'Falta saldo inicial':initial.quantity===null?'Saldo inicial por confirmar':!initial.verified?'Saldo inicial pendiente de validar':'';}
 }
 for(const o of openings){
  const p=products.find(p=>p.id===o.product_id),quantity=o.quantity!==null&&Number.isFinite(Number(o.quantity))?Number(o.quantity):null;
  rows.push({id:`opening:${o.product_id}:${o.warehouse_id}`,date:o.as_of,registeredAt:o.created_at,productId:o.product_id,productName:p?.name||'Producto sin dato',presentation:p?.presentation||'',unit:p?.unit||'',family:familyOf(p),warehouseId:o.warehouse_id,warehouseName:warehouse(o.warehouse_id),kind:'opening',typeLabel:MOVEMENT_KINDS.opening,delta:null,direction:'opening',before:null,balance:quantity,balanceNote:quantity===null?'Saldo inicial por confirmar':!o.verified?'Saldo inicial pendiente de validar':'',origin:'Carga inicial',destination:warehouse(o.warehouse_id),actorId:'',actor:'No registrado para el saldo inicial',responsible:'',reference:o.source_reference,operation:undefined,reversal:false,source:o.source_reference});
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||(a.kind==='opening'&&b.kind!=='opening'?-1:b.kind==='opening'&&a.kind!=='opening'?1:compare(a,b)));
}
export type KardexFilters={search:string;from:string;to:string;product:string;warehouse:string;family:string;kind:string;direction:string;actor:string;responsible:string};
export const EMPTY_FILTERS:KardexFilters={search:'',from:'',to:'',product:'',warehouse:'',family:'',kind:'',direction:'',actor:'',responsible:''};
export function filterLedger(rows:LedgerRow[],f:KardexFilters){return rows.filter(r=>(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to)&&(!f.product||r.productId===f.product)&&(!f.warehouse||r.warehouseId===f.warehouse)&&(!f.family||r.family===f.family)&&(!f.kind||r.kind===f.kind)&&(!f.direction||r.direction===f.direction)&&(!f.actor||r.actorId===f.actor)&&(!f.responsible||r.responsible===f.responsible)&&normalized(`${r.productName} ${r.presentation} ${r.reference} ${r.warehouseName} ${r.origin} ${r.destination} ${r.actor} ${r.responsible} ${r.operation?.nisira_reference||''}`).includes(normalized(f.search)));}
export function ledgerTotals(rows:LedgerRow[]){const units:Record<string,{in:number;out:number}>={};for(const r of rows)if(r.kind!=='opening'&&r.delta!==null){const u=units[r.unit||'Sin unidad']??={in:0,out:0};if(r.delta>0)u.in=rounded(u.in+r.delta);else u.out=rounded(u.out-r.delta);}return units;}
const csvCell=(v:unknown)=>{const raw=String(v??'');const safe=/^[\s]*[=+@-]/.test(raw)&&!/^[-+]?\d+(\.\d+)?$/.test(raw)?`'${raw}`:raw;return `"${safe.replaceAll('"','""')}"`;};
export function ledgerCsv(rows:LedgerRow[]){const header=['Fecha física','Registrado el (UTC)','Producto','Presentación','Familia','Almacén del movimiento','Tipo','Origen','Destino','Entrada','Salida','Unidad','Saldo después','Registró','Responsable entrega','Referencia','Estado del documento','Observación del saldo'];return '\uFEFF'+[header,...rows.map(r=>[r.date,r.registeredAt,r.productName,r.presentation,FAMILIES[r.family],r.warehouseName,r.typeLabel,r.origin,r.destination,r.delta!==null&&r.delta>0?r.delta:'',r.delta!==null&&r.delta<0?-r.delta:'',r.unit,r.balance??'',r.actor,r.responsible,r.reference,r.operation?states[r.operation.status]||r.operation.status:'',r.balanceNote])].map(row=>row.map(csvCell).join(',')).join('\r\n');}
export function periodBalances(rows:LedgerRow[],product:string,warehouse:string,from:string,to:string){const series=rows.filter(r=>r.productId===product&&r.warehouseId===warehouse);const initial=series.find(r=>r.kind==='opening');const before=from?series.filter(r=>r.date<from||(r.kind==='opening'&&r.date===from)).at(-1):initial;const end=series.filter(r=>!to||r.date<=to).at(-1);const conflict=series.some(r=>r.balanceNote.startsWith('Hay registros anteriores'));return {before:conflict?null:before?.balance??null,end:conflict?null:end?.balance??null,unit:initial?.unit||series[0]?.unit||'',cut:initial?.date||''};}
