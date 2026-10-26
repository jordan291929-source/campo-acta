import {useEffect,useState} from 'react';
import {rpc} from './api';
import type {Run} from './Masters';
type Account={id:string;email:string;full_name:string;role:string;active:boolean;created_at:string};

// Aprobación de cuentas: una cuenta nueva no ve ni modifica nada hasta que administración la activa.
export function Users({run,self}:{run:Run;self?:string}){
 const [accounts,setAccounts]=useState<Account[]>(),[error,setError]=useState('');
 const reload=async()=>{try{setAccounts(await rpc<Account[]>('field_list_users',{}));setError('');}catch(e){setError(e instanceof Error?e.message:'No se pudieron cargar las cuentas');}};
 useEffect(()=>{void reload();},[]);
 const set=(a:Account,active:boolean,admin:boolean)=>run(async()=>{await rpc('field_set_user_access',{p_id:a.id,p_active:active,p_admin:admin});await reload();});
 const pending=accounts?.filter(a=>!a.active).length??0;
 return <section className="card"><h2>Usuarios</h2>
  <p className="field-help">Las cuentas nuevas quedan <b>pendientes</b> y no ven información hasta que las apruebes. <b>Campo</b> registra salidas y productores; <b>Administración</b> además edita productos, precios, carga inicial, datos de empresa, usuarios y puede eliminar documentos.</p>
  {error&&<p className="alert">{error}{/field_list_users/.test(error)&&' Ejecuta la migración 202610260009_account_approval.sql en Supabase.'}</p>}
  {!!pending&&<p className="missing"><b>{pending} {pending===1?'cuenta pendiente':'cuentas pendientes'} de aprobación.</b> Aprueba solo a personas que conozcas.</p>}
  {accounts&&<div className="table-wrap"><table><thead><tr><th>Persona</th><th>Estado</th><th>Creada</th><th></th></tr></thead><tbody>{accounts.map(a=><tr key={a.id}>
   <td><b>{a.full_name}</b><small>{a.email}</small></td>
   <td><span className={`pill ${a.active?'ok':''}`}>{!a.active?'Pendiente / sin acceso':a.role==='admin'?'Administración':'Campo'}</span></td>
   <td>{new Date(a.created_at).toLocaleDateString('es-PE',{timeZone:'America/Lima'})}</td>
   <td>{a.id===self?<small>Tu cuenta</small>:<div className="row-actions">
    {!a.active&&<><button onClick={()=>set(a,true,false)}>Aprobar como Campo</button><button className="quiet" onClick={()=>set(a,true,true)}>Aprobar como Administración</button></>}
    {a.active&&a.role!=='admin'&&<button className="quiet" onClick={()=>set(a,true,true)}>Hacer administración</button>}
    {a.active&&a.role==='admin'&&<button className="quiet" onClick={()=>set(a,true,false)}>Pasar a Campo</button>}
    {a.active&&<button className="quiet danger-text" onClick={()=>{if(window.confirm(`¿Quitar el acceso de ${a.full_name}?`))set(a,false,false);}}>Quitar acceso</button>}
   </div>}</td></tr>)}</tbody></table></div>}
 </section>;
}
