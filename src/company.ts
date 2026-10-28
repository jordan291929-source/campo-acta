import type {Details,Producer} from './model';
import {money} from './model';
export const COMPANY_NAME='FRUGLOBE S.A.C.';

// La identidad fiscal se obtiene de Supabase, nunca del bundle público.
export const DEFAULT_COMPANY:Details={};
export const COMPANY_FIELDS=[['company_ruc','RUC de FRUGLOBE'],['company_address','Dirección de FRUGLOBE'],['company_phone','Teléfono de FRUGLOBE (membrete)'],['representative_name','Nombre de quien firma por FRUGLOBE'],['representative_document','DNI / CE de quien firma'],['authority','Cargo y documento que acredita su representación'],['bank','Banco y titular de la cuenta en soles'],['account','Cuenta bancaria o CCI de FRUGLOBE en soles'],['payment_channel','Dónde enviar la constancia de pago'],['copy_channel','Cómo se entrega la copia del acta']] as const;
export const COMPANY_CONFIG_FIELDS=[...COMPANY_FIELDS,['engineers','Ingenieros de Campo (nombre y DNI / CE)']] as const;
const engineerKey=(value:string)=>value.replace(/^\s*Ing\.?\s+/i,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
export function engineerRecords(defaults:Details){
 const result:{name:string;document:string}[]=[];
 for(const raw of (defaults.engineers??'').split(/\r?\n/)){const [rawName,rawDocument='']=raw.split('|');const name=rawName.replace(/^\s*Ing\.?\s+/i,'').trim();if(!name)continue;const found=result.find(e=>engineerKey(e.name)===engineerKey(name));if(found){if(!found.document)found.document=rawDocument.trim();}else result.push({name,document:rawDocument.trim()});}
 return result;
}
export function engineerList(defaults:Details){return engineerRecords(defaults).map(e=>e.name);}
export function findEngineer(value:string,names:string[]){return names.find(name=>engineerKey(name)===engineerKey(value));}
export function engineerDocument(value:string,defaults:Details){return engineerRecords(defaults).find(e=>engineerKey(e.name)===engineerKey(value))?.document??'';}
// Una cuenta marcada en dólares no se puede presentar como cuenta en soles.
export function hasDollarBank(details:Details){return /d[óo]lar(?:es)?|dollars?|\bUSD\b|US\$/i.test(details.bank??'');}
export function solesBankDetails(details:Details):Details{
 return hasDollarBank(details)?{...details,bank:(details.bank??'').replace(/d[óo]lar(?:es)?|dollars?|\bUSD\b|US\$/gi,'Soles'),account:''}:{...details};
}
// La cuenta del catálogo se usa en borradores y completa cuentas pendientes de actas anteriores.
export function actaBankDetails(details:Details,defaults:Details,preferCurrent=false):Details{
 const saved=solesBankDetails(details),current=solesBankDetails(defaults);
 if(preferCurrent&&('bank'in defaults||'account'in defaults))return {...saved,bank:current.bank??'',account:current.account??'',payment_channel:current.payment_channel??saved.payment_channel??''};
 if(!hasDollarBank(defaults)&&current.bank?.trim()&&current.account?.trim()&&(hasDollarBank(details)||!saved.account?.trim()))return {...saved,bank:current.bank,account:current.account,payment_channel:saved.payment_channel||current.payment_channel||''};
 return saved;
}
export function actaDetails(details:Details,defaults:Details,producer:Producer|undefined,total:number,currency:string):Details{
 const result={...details};
 for(const [key]of COMPANY_FIELDS)if(!result[key]&&defaults[key])result[key]=defaults[key];
 const legacyOther=!!(producer&&details.receiver&&details.receiver!==producer.name&&!details.receiver_mode);
 const other=details.receiver_mode==='other'||legacyOther;
 if(producer&&!other){result.receiver=producer.name;result.receiver_document=producer.document;result.receiver_mode='producer';}
 else if(other)result.receiver_mode='other';
 if(!details.initial_debt||details.initial_debt_mode==='auto'){result.initial_debt=money(total,currency);result.initial_debt_mode='auto';}
 return result;
}
// El ingeniero firma esta entrega; no hereda el DNI ni el cargo del representante general.
export function engineerActaDetails(details:Details,defaults:Details,producer:Producer|undefined,total:number,currency:string):Details{
 return {...actaBankDetails(actaDetails(details,defaults,producer,total,currency),defaults,true),payment_method:'Transferencia',representative_name:details.responsible?.trim()||'',representative_document:details.representative_document??engineerDocument(details.responsible??'',defaults),authority:details.authority??'Ingeniero de Campo'};
}
export function dateInput(value=''){
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 const m=value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:'';
}
