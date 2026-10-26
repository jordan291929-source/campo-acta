import type {Details,Producer} from './model';
import {money} from './model';
export const COMPANY_NAME='FRUGLOBE S.A.C.';

// La identidad fiscal se obtiene de Supabase, nunca del bundle público.
export const DEFAULT_COMPANY:Details={};
export const COMPANY_FIELDS=[['company_ruc','RUC de FRUGLOBE'],['company_address','Dirección de FRUGLOBE'],['company_phone','Teléfono de FRUGLOBE (membrete)'],['representative_name','Nombre de quien firma por FRUGLOBE'],['representative_document','DNI / CE de quien firma'],['authority','Cargo y documento que acredita su representación'],['bank','Banco y titular de la cuenta'],['account','Cuenta bancaria o CCI de FRUGLOBE'],['payment_channel','Dónde enviar la constancia de pago'],['copy_channel','Cómo se entrega la copia del acta']] as const;
export const COMPANY_CONFIG_FIELDS=[...COMPANY_FIELDS,['engineers','Ingenieros de Campo (un nombre por línea)']] as const;
export function engineerList(defaults:Details){
 const result:string[]=[];const seen=new Set<string>();
 for(const raw of (defaults.engineers??'').split(/\r?\n/)){const name=raw.replace(/^\s*Ing\.?\s+/i,'').trim();const key=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();if(name&&!seen.has(key)){seen.add(key);result.push(name);}}
 return result;
}
export function findEngineer(value:string,names:string[]){
 const key=(s:string)=>s.replace(/^\s*Ing\.?\s+/i,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
 return names.find(name=>key(name)===key(value));
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
export function dateInput(value=''){
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 const m=value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:'';
}
