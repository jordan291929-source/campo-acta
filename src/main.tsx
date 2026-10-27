import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Session} from '@supabase/supabase-js';
import {supabase} from './supabase';
import {all,db} from './api';
import {Producers,Products} from './Masters';
import {StockInventory} from './StockInventory';
import {Kardex} from './MovementKardex';
import type {Audit,Movement,Opening,Profile} from './kardex';
import {Imports} from './Imports';
import {Operations} from './Operations';
import {CompanySettings} from './CompanySettings';
import {Users} from './Users';
import {DEFAULT_COMPANY} from './company';
import type {Details} from './model';
import {type Operation,type Product,type Producer,type Stock,type Warehouse} from './model';
import type {HistoryGroup} from './excel';
import logo from './assets/fruglobe-logo.jpeg';
import './style.css';
import './flow.css';
import './acta-fields.css';

function App(){
 const [session,setSession]=useState<Session|null>(null),[initializing,setInitializing]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [signup,setSignup]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState('');
 const [tab,setTab]=useState('stock'),[products,setProducts]=useState<Product[]>([]),[producers,setProducers]=useState<Producer[]>([]),[warehouses,setWarehouses]=useState<Warehouse[]>([]),[stock,setStock]=useState<Stock[]>([]),[operations,setOperations]=useState<Operation[]>([]),[movements,setMovements]=useState<Movement[]>([]),[audit,setAudit]=useState<Audit[]>([]),[openings,setOpenings]=useState<Opening[]>([]),[profiles,setProfiles]=useState<Profile[]>([]),[loaded,setLoaded]=useState(false),[updated,setUpdated]=useState('');
 const [operationRequest,setOperationRequest]=useState<{id:string;key:number}>();
 const [seed,setSeed]=useState<HistoryGroup>(),[editorKey,setEditorKey]=useState(0),[canManageCatalog,setCanManageCatalog]=useState(false),[permissionsMissing,setPermissionsMissing]=useState(false),[companyDefaults,setCompanyDefaults]=useState<Details>(DEFAULT_COMPANY),[companyAvailable,setCompanyAvailable]=useState(false),[pending,setPending]=useState(false);
 useEffect(()=>{
  if(!supabase){setInitializing(false);return;}
  let active=true;
  supabase.auth.getSession().then(({data,error})=>{if(active){setSession(data.session);setInitializing(false);if(error)setError(error.message);}}).catch(()=>{if(active){setInitializing(false);setError('No se pudo recuperar la sesión');}});
  const {data}=supabase.auth.onAuthStateChange((event,next)=>{setSession(next);if(event==='SIGNED_OUT'){setStock([]);setMovements([]);setAudit([]);setOpenings([]);setProfiles([]);setOperationRequest(undefined);setProducts([]);setProducers([]);setOperations([]);setLoaded(false);setCanManageCatalog(false);setPermissionsMissing(false);setCompanyDefaults(DEFAULT_COMPANY);setCompanyAvailable(false);setError('');}});
  return()=>{active=false;data.subscription.unsubscribe();};
 },[]);
 async function load(){
  // Cuenta sin aprobar: no se consulta nada más. Sin la migración 009 la función no existe y se sigue como antes.
  const me=await db().rpc('field_my_access');const waiting=!me.error&&(me.data as {member?:boolean})?.member===false;setPending(waiting);if(waiting){setLoaded(false);return;}
  const access=await db().rpc('field_can_manage_catalog');setCanManageCatalog(!access.error&&access.data===true);setPermissionsMissing(!!access.error);if(access.error||access.data!==true)setTab(t=>['imports','company','users'].includes(t)?'stock':t);
  const company=await db().rpc('field_company_defaults');setCompanyAvailable(!company.error);setCompanyDefaults({...DEFAULT_COMPANY,...(company.error?{}:company.data??{})});
  const results=await Promise.all([all<Product>('products','name'),all<Producer>('producers','name'),all<Warehouse>('warehouses','name'),all<Stock>('stock_current','product_name'),all<Operation>('field_operations','number'),all<Movement>('stock_movements','created_at'),all<Audit>('field_audit','created_at'),all<Opening>('opening_balances','created_at'),all<Profile>('profiles','full_name')]);
  setProducts(results[0]);setProducers(results[1]);setWarehouses(results[2]);setStock(results[3]);setOperations(results[4].reverse());setMovements(results[5].reverse());setAudit(results[6].reverse());setOpenings(results[7]);setProfiles(results[8]);setLoaded(true);setUpdated(new Date().toLocaleTimeString('es-PE',{timeZone:'America/Lima'}));
 }
 async function run(action:()=>Promise<void>){setBusy(true);setError('');setMessage('');try{await action();await load();}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la operación');window.scrollTo(0,0);}finally{setBusy(false);}}
 useEffect(()=>{if(session)void run(async()=>{});},[session?.user.id]);
 async function authenticate(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{
  if(signup){const {data,error}=await db().auth.signUp({email:email.trim(),password,options:{data:{full_name:name.trim()},emailRedirectTo:window.location.origin}});if(error)throw error;if(!data.session)setMessage('Cuenta solicitada. Revisa tu correo para confirmarla. Luego administración debe aprobarla antes de que puedas ver la información.');else setPassword('');}
  else{const {error}=await db().auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword('');}
 }catch(e){setError(e instanceof Error?e.message:'No se pudo ingresar');}finally{setBusy(false);}}
 const who=String(session?.user.user_metadata?.full_name||session?.user.email||'Usuario');

 if(initializing)return <main className="center">Recuperando sesión…</main>;
 return <><div className="screen"><header><a className="brand" href="/"><img className="brand-logo" src={logo} alt="Fruglobe"/><span className="brand-title">Acta de entrega y recepción de insumos agrícolas<small>FRUGLOBE · Control de insumos</small></span></a><span className="badge">Control interno de campo</span>{session&&<button className="quiet" disabled={busy} onClick={()=>{void db().auth.signOut().then(({error})=>{if(error)setError(error.message);});}}>Salir</button>}</header>
 {!session?<main className="login-layout"><section><p className="eyebrow">CAMPO Y ALMACÉN</p><h1>Cada entrega,<br/>con su respaldo.</h1><p className="intro">Stock, productores y actas de entrega en una sola herramienta compartida.</p><div className="note">Si eres nuevo, crea tu cuenta y pide a administración que la apruebe. Solo las cuentas aprobadas ven stock, productores y actas.</div></section><section className="card login"><h2>{signup?'Crea tu cuenta':'Ingresa a tu espacio'}</h2>{!supabase?<p className="alert">Falta configurar la URL y clave pública de Supabase en Vercel.</p>:<form onSubmit={authenticate}>{signup&&<label>Tu nombre<input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>}<label>Correo<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label><label>Contraseña<input required type="password" minLength={signup?8:undefined} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={signup?'new-password':'current-password'}/></label>{error&&<p className="alert" role="alert">{error}</p>}{message&&<p className="note" role="status">{message}</p>}<button disabled={busy}>{busy?'Procesando…':signup?'Crear cuenta':'Ingresar'}</button><button type="button" className="quiet" onClick={()=>{setSignup(!signup);setError('');setMessage('');}}>{signup?'Ya tengo cuenta':'Crear una cuenta'}</button></form>}</section></main>:pending?<main className="dashboard"><section className="card pending-account"><h1>Tu cuenta está pendiente de aprobación</h1><p>Ingresaste como <b>{session.user.email}</b>. Por seguridad, administración debe aprobar tu cuenta antes de que puedas ver stock, productores y actas.</p><p>Avísale a la persona encargada y luego presiona <b>Revisar de nuevo</b>.</p><button disabled={busy} onClick={()=>void run(load)}>{busy?'Revisando…':'Revisar de nuevo'}</button></section></main>:<main className="dashboard"><div className="title-row"><div><p className="eyebrow">CONTROL COMPARTIDO</p><h1>Acta de entrega y recepción de insumos agrícolas</h1><p>{who}</p></div><button disabled={busy} onClick={()=>void run(load)}>{busy?'Procesando…':'Actualizar información'}</button></div><nav className="tabs">{[['stock','Stock'],['operations','Salidas y actas'],['producers','Productores'],['products','Productos'],['imports','Carga inicial'],['company','Datos de empresa'],['users','Usuarios'],['history','Kardex / Movimientos']].filter(([id])=>!['imports','company','users'].includes(id)||canManageCatalog).map(([id,label])=><button key={id} className={tab===id?'active':'quiet'} disabled={busy} onClick={()=>setTab(id)}>{label}</button>)}</nav>{error&&<div className="alert" role="alert">{error}{!loaded&&<p>Si acabas de actualizar, ejecuta la migración <a href="https://github.com/jordan291929-source/campo-acta/blob/main/supabase/migrations/202610260002_full_flow.sql" target="_blank" rel="noreferrer">202610260002_full_flow.sql</a> en Supabase. No repitas el SQL inicial.</p>}</div>}{message&&<p className="note" role="status">{message}</p>}
 {permissionsMissing&&<p className="note">Falta instalar la actualización de permisos. La carga inicial y la edición de productos permanecerán cerradas hasta aplicarla.</p>}<fieldset disabled={busy} className="workspace">
 {loaded&&tab==='stock'&&<StockInventory stock={stock} products={products} warehouses={warehouses} updated={updated} canManage={canManageCatalog} onImport={()=>setTab('imports')}/>}
 {loaded&&<div hidden={tab!=='producers'}><Producers rows={producers} run={run}/></div>}
 {loaded&&<div hidden={tab!=='products'}><Products rows={products} warehouses={warehouses} run={run} canManage={canManageCatalog}/></div>}
 {loaded&&canManageCatalog&&<div hidden={tab!=='imports'}><Imports run={run} onHistory={g=>{setOperationRequest(undefined);setSeed(g);setEditorKey(k=>k+1);setTab('operations');}}/></div>}
 {loaded&&<div hidden={tab!=='operations'}><Operations openRequest={operationRequest} active={tab==='operations'} key={editorKey} seed={seed} rows={operations} products={products} producers={producers} warehouses={warehouses} stock={stock} run={run} name={who} companyDefaults={companyDefaults} canManage={canManageCatalog}/></div>}
 {loaded&&canManageCatalog&&tab==='users'&&<Users run={run} self={session.user.id}/>}
 {loaded&&canManageCatalog&&tab==='company'&&<CompanySettings defaults={companyDefaults} available={companyAvailable} run={run}/>}
 {loaded&&tab==='history'&&<Kardex movements={movements} openings={openings} products={products} warehouses={warehouses} operations={operations} profiles={profiles} audit={audit} producers={producers} updated={updated} onOpen={id=>{setOperationRequest(r=>({id,key:(r?.key??0)+1}));setTab('operations');}}/>}
 </fieldset></main>}<footer>Acta de entrega y recepción de insumos agrícolas · Administración de Campo y Almacén</footer></div></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
