import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import './style.css';

type Stock = { product_id: string; warehouse_id: string; product_name: string; presentation: string; unit: string; warehouse_name: string; quantity: number | string | null; verified: boolean; as_of: string | null };
type Profile = { full_name: string; role: string; active: boolean };
const roles: Record<string, string> = { admin: 'Administrador', campo: 'Campo', almacen: 'Almacén', administracion: 'Administración' };
const number = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 3 });

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<Stock[]>([]);
  const [warehouse, setWarehouse] = useState('');
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState('');

  useEffect(() => {
    if (!supabase) { setInitializing(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setError('No se pudo recuperar la sesión. Vuelve a ingresar.');
      setSession(data.session); setInitializing(false);
    }).catch(() => { if (alive) { setError('No se pudo conectar con Supabase.'); setInitializing(false); } });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next); setProfile(null); setRows([]); setLoaded(false); setUpdatedAt(''); setError('');
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  async function load() {
    if (!supabase || !session) return;
    setBusy(true); setError(''); setLoaded(false); setRows([]); setUpdatedAt('');
    try {
      const { data: user, error: profileError } = await supabase.from('profiles').select('full_name,role,active').eq('id', session.user.id).maybeSingle();
      if (profileError) throw new Error('No se pudo consultar el acceso. Comprueba que la instalación SQL esté aplicada.');
      setProfile(user);
      if (!user?.active) throw new Error('Tu usuario aún no tiene acceso habilitado. Solicítalo al administrador.');
      const { data, error: stockError } = await supabase.from('stock_current').select('*').order('product_name');
      if (stockError) throw new Error('No se pudo consultar el stock. Actualiza o comunícalo al administrador.');
      setRows(data ?? []); setLoaded(true); setUpdatedAt(new Date().toLocaleTimeString('es-PE'));
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la información.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (session) void load(); }, [session?.user.id]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); if (!supabase) return;
    setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError('No se pudo ingresar. Revisa tus credenciales y que el usuario esté confirmado.');
      else setPassword('');
    } catch { setError('No se pudo conectar. Revisa tu conexión e inténtalo otra vez.'); }
    finally { setBusy(false); }
  }

  const visible = rows.filter(r => (!warehouse || r.warehouse_name === warehouse) && `${r.product_name} ${r.presentation}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  const warehouses = [...new Set(rows.map(r => r.warehouse_name))];
  if (initializing) return <main className="center"><p>Recuperando sesión…</p></main>;
  return <>
    <header><a className="brand" href="/">CA<span>Campo Acta<small>FRUGLOBE · Control de insumos</small></span></a><span className="badge">Versión inicial</span>{session && <button className="quiet" onClick={async () => { const { error } = await supabase!.auth.signOut(); if (error) setError('No se pudo cerrar sesión. Intenta nuevamente.'); }}>Salir</button>}</header>
    {!session ? <main className="login-layout"><section><p className="eyebrow">CAMPO Y ALMACÉN</p><h1>Cada entrega,<br />con su respaldo.</h1><p className="intro">Una base compartida para consultar las existencias y preparar el control de entregas a productores y consumo propio.</p><div className="note">Las entregas históricas ya descontadas se formalizarán sin volver a afectar el stock.</div></section><section className="card login"><h2>Ingresa a tu espacio</h2><p>Usa el correo habilitado por el administrador.</p>{!supabase ? <p className="alert" role="alert">Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en el alojamiento.</p> : <form onSubmit={login}><label>Correo electrónico<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>{error && <p role="alert" className="alert">{error}</p>}<button disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button><small>El acceso se habilita por invitación. No hay registro público.</small></form>}</section></main> : <main className="dashboard">
      <div className="title-row"><div><p className="eyebrow">INVENTARIO COMPARTIDO</p><h1>Existencias por ubicación</h1><p>{profile ? `${profile.full_name} · ${roles[profile.role] ?? profile.role}` : session.user.email}</p></div><button disabled={busy} onClick={() => void load()}>{busy ? 'Consultando…' : 'Actualizar stock'}</button></div>
      {error && <p role="alert" className="alert">{error}</p>}
      {loaded && <><section className="stats"><div className="card"><span>Productos registrados</span><strong>{new Set(rows.map(r => r.product_id)).size}</strong></div><div className="card"><span>Ubicaciones con registros</span><strong>{warehouses.length}</strong></div><div className="card"><span>Saldos pendientes de confirmar</span><strong>{rows.filter(r => !r.verified || r.quantity === null).length}</strong></div></section>
      <section className="card inventory"><div className="filters"><label>Buscar insumo<input type="search" placeholder="Nombre o presentación" value={search} onChange={e => setSearch(e.target.value)} /></label><label>Ubicación<select value={warehouse} onChange={e => setWarehouse(e.target.value)}><option value="">Todas las ubicaciones</option>{warehouses.map(w => <option key={w}>{w}</option>)}</select></label></div><div className="table-wrap"><table><thead><tr><th>Insumo</th><th>Ubicación</th><th>Saldo</th><th>Unidad de control</th><th>Fecha de corte</th><th>Validación</th></tr></thead><tbody>{visible.map(r => <tr key={`${r.product_id}-${r.warehouse_id}`}><td><b>{r.product_name}</b><small>{r.presentation}</small></td><td>{r.warehouse_name}</td><td>{r.quantity === null ? 'Por confirmar' : number.format(Number(r.quantity))}</td><td>{r.unit}</td><td>{r.as_of ?? 'Por definir'}</td><td><span className={`pill ${r.verified ? 'ok' : ''}`}>{r.verified ? 'Confirmado' : 'Pendiente'}</span></td></tr>)}</tbody></table></div>{!visible.length && <div className="empty"><h2>{rows.length ? 'Sin coincidencias' : 'El inventario está listo para su carga inicial'}</h2><p>{rows.length ? 'Cambia los filtros para ver otros productos.' : 'Aún no se han cargado saldos. Primero deben conciliarse la fecha de corte, las presentaciones y los cuatro saldos con error del almacén Sur.'}</p></div>}<p className="footnote">Última consulta: {updatedAt}. Actualiza para ver cambios de otros usuarios. Los saldos se muestran por unidad de control; no se suman litros, kilos y envases.</p></section></>}
      <div className="note"><b>Alcance de esta versión:</b> acceso privado y consulta central de stock. La emisión de actas y el registro de movimientos se incorporarán en la siguiente etapa.</div>
    </main>}
    <footer>Campo Acta · Administración de Campo y Almacén</footer>
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
