import {supabase} from './supabase';
export const db=()=>{if(!supabase)throw new Error('Falta configurar Supabase');return supabase;};
export async function rpc<T=unknown>(name:string,args:Record<string,unknown>):Promise<T>{const {data,error}=await db().rpc(name,args);if(error)throw new Error(error.message);return data as T;}
export async function all<T>(table:string,order?:string):Promise<T[]>{const result:T[]=[];for(let start=0;;start+=1000){let query=db().from(table).select('*').range(start,start+999);if(order)query=query.order(order);const {data,error}=await query;if(error)throw new Error(error.message);result.push(...(data??[]) as T[]);if(!data||data.length<1000)break;}return result;}
export async function lines(id:string){const {data,error}=await db().from('field_lines').select('*').eq('operation_id',id).order('id');if(error)throw new Error(error.message);return data??[];}
