import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {db,lines,rpc} from './api';
import {Acta} from './Acta';
import {ActaFields} from './ActaFields';
import {actaDetails,DEFAULT_COMPANY,engineerList,findEngineer} from './company';
import type {HistoryGroup} from './excel';
import type {Details,Line,Operation,Producer,Product,Stock,Warehouse} from './model';
import {code,kinds,money,normalized,states,today,packageContent,packageCount,packageLabel} from './model';
import {convertPrice,fetchUsdPen} from './exchange';
import type {Run} from './Masters';
const kindChoices:[string,string,string][]=[
 ['delivery','Entrega a productor','Sale del almacén y genera acta con descuento'],
 ['own_consumption','Consumo propio','Uso en Chincha o fundo, sin deuda'],
 ['transfer','Traslado entre almacenes','Mueve stock de un almacén a otro'],
 ['purchase','Ingreso de compra','Suma stock al almacén'],
 ['historical','Regularizar entrega antigua','Solo genera el acta, no descuenta stock'],
];
// Íconos simples (trazo) para reconocer cada tipo de documento a simple vista.
const kindIcons:Record<string,string>={
 delivery:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 11l2 2 4-4',
 own_consumption:'M7 20h10M12 20V10M12 10c0-4 3-6 7-6 0 4-3 6-7 6M12 13c0-3-2-5-6-5 0 3 2 5 6 5',
 transfer:'M7 7h13l-4-4M17 17H4l4 4',
 purchase:'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
 historical:'M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
};
const staffKinds=['transfer','purchase'];
const KindIcon=({kind}:{kind:string})=><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={kindIcons[kind]}/></svg>;
export function Operations({rows,products,producers,warehouses,stock,run,name,seed,active=true,companyDefaults=DEFAULT_COMPANY,canManage=false}:{rows:Operation[];products:Product[];producers:Producer[];warehouses:Warehouse[];stock:Stock[];run:Run;name:string;seed?:HistoryGroup;active?:boolean;companyDefaults?:Details;canManage?:boolean}){
 const fresh=(kind='delivery'):Operation=>({id:crypto.randomUUID(),kind,status:'draft',warehouse_id:warehouses.find(w=>w.code==='SUR')?.id??'',destination_id:null,producer_id:null,occurred_on:today(),currency:'PEN',details:{responsible:''}});
 const fromHistory=()=>({...fresh(seed!.stockAlreadyDiscounted===false?'delivery':'historical'),occurred_on:seed!.date,warehouse_id:warehouses.find(w=>w.code===seed!.warehouse)?.id??'',details:{responsible:seed!.responsible||'',source:seed!.key,import_key:seed!.key,notes:seed!.description}});
 const [op,setOp]=useState<Operation>(seed?fromHistory():fresh()),[items,setItems]=useState<Line[]>(seed?seed.items.map(i=>({product_id:products.find(p=>normalized(p.name)===normalized(i.name))?.id??'',quantity:i.quantity,price:0})):[]),[preview,setPreview]=useState(false),[query,setQuery]=useState(''),[filter,setFilter]=useState(''),[nisira,setNisira]=useState(''),[cancelReason,setCancelReason]=useState('');
 const readonly=op.status!=='draft';const isProducer=['delivery','historical'].includes(op.kind);
 const rate=Number(op.details.exchange_rate)||0;
 const priceOf=(id:string,currency:string,r:number)=>{const p=products.find(p=>p.id===id);return p?convertPrice(Number(op.kind==='purchase'?p.cost_price:p.sale_price),p.currency,currency,r):0;};
 // El precio no se edita en la salida: siempre es el del catálogo de Productos, convertido con el tipo de cambio.
 const priced=readonly?items:items.map(l=>({...l,price:priceOf(l.product_id,op.currency,rate)}));
 const enriched=priced.map(l=>{const p=products.find(p=>p.id===l.product_id);return {...l,product_name:l.product_name??p?.name,presentation:l.presentation??p?.presentation,unit:l.unit??p?.unit};});
 const total=priced.reduce((s,l)=>s+Math.round((l.quantity*l.price+Number.EPSILON)*100)/100,0);
 const selectedProducer=readonly?op.producer_snapshot:producers.find(p=>p.id===op.producer_id);
 const engineers=engineerList(companyDefaults);const selectedEngineer=findEngineer(op.details.responsible??'',engineers);
 const resolvedDetails=readonly?op.details:{...actaDetails(op.details,companyDefaults,selectedProducer,total,op.currency),responsible:selectedEngineer||op.details.responsible||''};
 function setRate(value:string,date:string,source:string){setOp(o=>({...o,details:{...o.details,exchange_rate:value,exchange_rate_date:date,exchange_rate_source:source,reviewed:''}}));}
 // Documento en soles sin tipo de cambio: propone el de hoy.
 useEffect(()=>{if(readonly||op.currency!=='PEN'||op.details.exchange_rate)return;let live=true;fetchUsdPen().then(x=>{if(live)setRate(String(x.rate),x.date,x.source);}).catch(()=>{});return()=>{live=false;};},[op.id,op.currency,readonly]);
 function details(k:string,v:string){setOp({...op,details:{...op.details,[k]:v}});}
 async function open(id:string){const {data,error}=await db().from('field_operations').select('*').eq('id',id).single();if(error)throw new Error(error.message);setOp(data.status==='draft'&&data.currency!=='PEN'?{...data,currency:'PEN'}:data);setNisira(data.nisira_reference??'');setItems(await lines(id));setPreview(false);}
 async function save(){await rpc('field_save_operation',{p:{...op,details:resolvedDetails},p_lines:priced.map(l=>({product_id:l.product_id,quantity:l.quantity,price:l.price})),p_version:op.version??null});await open(op.id);}
 const printOp={...op,details:{...resolvedDetails,company_ruc:resolvedDetails.company_ruc||companyDefaults.company_ruc||''},total:readonly?Number(op.total??total):total,producer_snapshot:readonly?op.producer_snapshot:producers.find(p=>p.id===op.producer_id)};
 const consumes=['delivery','own_consumption','transfer'].includes(op.kind);
 // En traslados e ingresos entrega o recibe personal de almacén, no un ingeniero de Campo.
 const warehouseStaff=staffKinds.includes(op.kind);
 const staffNames=[...new Set(rows.filter(o=>staffKinds.includes(o.kind)).map(o=>o.details?.responsible?.trim()).filter((n):n is string=>!!n))].sort();
 const balanceOf=(productId:string)=>stock.find(s=>s.product_id===productId&&s.warehouse_id===op.warehouse_id)?.quantity??null;
 const shortLines=consumes&&items.some(l=>{const b=balanceOf(l.product_id);return !!l.product_id&&b!==null&&l.quantity>Number(b);});
 const needsRate=op.currency==='PEN'&&!(rate>0)&&items.some(l=>products.find(p=>p.id===l.product_id)?.currency==='USD');
 // Lista en lenguaje simple de lo que falta antes de emitir.
 const missing=[
  isProducer&&!op.producer_id&&'Elegir el productor (paso 2).',
  isProducer&&selectedProducer&&!selectedProducer.document&&'El productor no tiene DNI/RUC: complétalo en Productores.',
  op.kind==='transfer'&&!op.destination_id&&'Elegir el almacén de destino (paso 2).',
  (warehouseStaff?!op.details.responsible?.trim()&&'Escribir el responsable de almacén (paso 2).':!selectedEngineer&&'Elegir el ingeniero que entrega (paso 2).'),
  !items.length&&'Agregar al menos un insumo (paso 3).',
  items.some(l=>!l.product_id)&&'Elegir el producto en cada insumo (paso 3).',
  items.some(l=>!(l.quantity>0))&&'Indicar la cantidad de cada insumo (paso 3).',
  shortLines&&'Hay insumos con más cantidad que el stock disponible (paso 3).',
  needsRate&&'Ingresar el tipo de cambio (paso 3).',
  isProducer&&op.details.reviewed!=='yes'&&'Marcar la casilla de revisión (paso 5).',
 ].filter((x):x is string=>!!x);
 const setQuantity=(i:number,quantity:number)=>setItems(items.map((x,j)=>i===j?{...x,quantity}:x));
 const destinationLabel=op.kind==='purchase'?'Proveedor y comprobante':'Fundo o destino del uso';
 const rateField=<label>Tipo de cambio (S/ por 1 USD)<input type="number" step="0.001" min="0.001" placeholder="Ej.: 3.380" value={op.details.exchange_rate??''} onChange={e=>setRate(e.target.value,today(),'manual')}/><small>{op.details.exchange_rate_date?`Consultado el ${op.details.exchange_rate_date} · ${op.details.exchange_rate_source==='manual'?'ingresado manualmente':op.details.exchange_rate_source}`:'Sin tipo de cambio'}{!readonly&&<> · <button type="button" className="link" onClick={()=>run(async()=>{const x=await fetchUsdPen();setRate(String(x.rate),x.date,x.source);})}>Usar TC de hoy</button></>}</small></label>;
 async function remove(target:Operation){
  const reason=window.prompt(`Eliminar ${code(target.number)} de forma definitiva.\nEscribe el motivo:`);
  if(reason===null)return;
  await rpc('field_delete_operation',{p_id:target.id,p_reason:reason});
  if(target.id===op.id){setOp(fresh());setItems([]);setPreview(false);}
 }
 return <><div className="screen"><div className="section-title"><h2>Salidas, actas e ingresos</h2><button onClick={()=>{setOp(fresh());setItems([]);setPreview(false);setCancelReason('');}}>+ Nuevo documento</button></div>
 <section className="card"><div className="section-title"><h3>{op.number?code(op.number):'Nuevo documento'} <span className="pill">{states[op.status]}</span></h3>{op.kind==='historical'&&<span className="pill">No descuenta stock</span>}</div>
 {readonly&&<p className="field-help">Documento {states[op.status].toLowerCase()}: solo lectura. Para corregirlo, anúlalo y registra uno nuevo.</p>}
 <form onSubmit={e=>{e.preventDefault();run(save);}}><fieldset disabled={readonly}>
 <section className="step"><h3><span className="step-number">1</span>¿Qué vas a registrar? <small className="step-hint">Toca una opción</small></h3>
  <div className="choices">{kindChoices.filter(([k])=>k!=='historical'||op.kind==='historical').map(([k,title,help])=><button type="button" key={k} className={`choice${op.kind===k?' selected':''}`} aria-pressed={op.kind===k} onClick={()=>setOp({...op,kind:k,destination_id:null,producer_id:null,details:staffKinds.includes(k)===warehouseStaff?op.details:{...op.details,responsible:''}})}><span className="choice-icon"><KindIcon kind={k}/></span><span className="choice-text"><b>{title}</b><span>{help}</span></span><span className="choice-radio" aria-hidden="true">{op.kind===k&&<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>}</span></button>)}</div>
 </section>
 <section className="step"><h3><span className="step-number">2</span>{isProducer?'¿A quién y cuándo?':'¿Dónde y cuándo?'}</h3>
  <div className="form-grid">
   {isProducer&&<label className="span2">Productor<select value={op.producer_id??''} onChange={e=>setOp({...op,producer_id:e.target.value||null})}><option value="">Elige el productor</option>{producers.map(p=><option key={p.id} value={p.id}>{p.name} · {p.predio||'Sin predio'}</option>)}</select>{selectedProducer&&<small>DNI / RUC: {selectedProducer.document||<strong className="warn">falta, complétalo en Productores</strong>} · Predio: {selectedProducer.predio||'sin dato'}{selectedProducer.details?.location?` · ${selectedProducer.details.location}`:''}</small>}</label>}
   <label>{op.kind==='purchase'?'Almacén donde ingresa':'Almacén de salida'}<select required value={op.warehouse_id} onChange={e=>setOp({...op,warehouse_id:e.target.value})}><option value="">Elige el almacén</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
   {op.kind==='transfer'&&<label>Almacén de destino<select value={op.destination_id??''} onChange={e=>setOp({...op,destination_id:e.target.value||null})}><option value="">Elige el destino</option>{warehouses.filter(w=>w.id!==op.warehouse_id).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
   {!isProducer&&op.kind!=='transfer'&&<label>{destinationLabel}<input value={op.details.destination??''} onChange={e=>details('destination',e.target.value)}/></label>}
   <label>Fecha de {op.kind==='purchase'?'ingreso':'entrega'}<input type="date" max={today()} required value={op.occurred_on} onChange={e=>setOp({...op,occurred_on:e.target.value})}/></label>
   {warehouseStaff?<label>{op.kind==='transfer'?'Responsable de almacén que entrega':'Responsable de almacén que recibe'}<input list="warehouse-staff" placeholder="Nombre y apellido" value={op.details.responsible??''} onChange={e=>details('responsible',e.target.value)}/><datalist id="warehouse-staff">{staffNames.map(n=><option key={n} value={n}/>)}</datalist></label>:<label>Ingeniero que entrega<select value={selectedEngineer??op.details.responsible??''} onChange={e=>details('responsible',e.target.value)}><option value="">{engineers.length?'Elige el ingeniero':'Configura el listado en Datos de empresa'}</option>{!selectedEngineer&&op.details.responsible&&<option value={op.details.responsible} disabled>{readonly?'Responsable guardado: ':'Valor anterior: '}{op.details.responsible}</option>}{engineers.map(engineer=><option key={engineer} value={engineer}>{engineer}</option>)}</select></label>}
   {isProducer&&<label>Lugar de entrega<input placeholder="Ej.: Fundo, almacén o caserío" value={op.details.place??''} onChange={e=>details('place',e.target.value)}/></label>}
  </div>
 </section>
 <section className="step"><h3><span className="step-number">3</span>Insumos</h3>
  <p className="field-help">Cuenta envases completos: bolsas, envases o cilindros. El precio sale del catálogo de Productos.</p>
  {seed&&<p className="alert">Revisa las unidades del kardex y asigna los productos que no coincidan.</p>}
  {priced.map((l,i)=>{const p=products.find(p=>p.id===l.product_id),balance=balanceOf(l.product_id),plural=p?packageCount(2,p.presentation,p.unit).replace(/^\S+\s/,''):'envases',short=consumes&&!!p&&balance!==null&&l.quantity>Number(balance);
   return <div className={`line-card${short?' short':''}`} key={i}>
    <label className="line-product">Insumo {i+1}<select required value={l.product_id} onChange={e=>setItems(items.map((x,j)=>i===j?{...x,product_id:e.target.value}:x))}><option value="">Elige el producto</option>{products.map(p=>{const b=balanceOf(p.id);return <option key={p.id} value={p.id}>{p.name} · {p.presentation}{consumes?` — ${b===null?'sin stock':`${packageCount(b,p.presentation,p.unit)} disponibles`}`:''}</option>;})}</select>{seed&&!l.product_id&&<small>Origen: {seed.items[i]?.name}</small>}</label>
    {p?<>
     {consumes&&<div><span className="mini">Disponible</span><b>{balance===null?'Sin saldo':packageCount(balance,p.presentation,p.unit)}</b><small>{packageContent(p.presentation,p.unit,p.package_size)&&`${packageContent(p.presentation,p.unit,p.package_size)} c/u`}</small></div>}
     <div><span className="mini">Cantidad ({plural})</span><div className="stepper"><button type="button" aria-label="Restar uno" onClick={()=>setQuantity(i,Math.max(1,l.quantity-1))}>−</button><input aria-label={`Cantidad ${i+1}`} type="number" inputMode="numeric" step={p.unit==='UN'?'1':'0.0001'} min={p.unit==='UN'?'1':'0.0001'} required value={l.quantity} onChange={e=>setQuantity(i,Number(e.target.value))}/><button type="button" aria-label="Sumar uno" onClick={()=>setQuantity(i,l.quantity+1)}>+</button></div>{short&&<small className="warn">Solo hay {packageCount(balance??0,p.presentation,p.unit)}</small>}</div>
     <div><span className="mini">Precio por {packageLabel(p.presentation,p.unit).toLowerCase()}</span><b>{money(l.price,op.currency)}</b></div>
     <div><span className="mini">Importe</span><b>{money(Math.round((l.quantity*l.price+Number.EPSILON)*100)/100,op.currency)}</b></div>
    </>:<span className="line-empty">Elige el producto para ver stock y precio</span>}
    {!readonly&&<button type="button" className="link line-remove" onClick={()=>setItems(items.filter((_,j)=>i!==j))}>Quitar</button>}
   </div>;})}
  {!readonly&&<button type="button" className="quiet add-line" onClick={()=>setItems([...items,{product_id:'',quantity:1,price:0}])}>+ Agregar insumo</button>}
  <div className="money-row">
   <label>Moneda del acta<select value={op.currency} onChange={e=>setOp({...op,currency:e.target.value,details:{...op.details,reviewed:''}})}><option value="PEN">Soles (S/)</option><option value="USD">Dólares (USD)</option></select></label>
   {op.currency==='PEN'&&rateField}
   <p className="total">Total: {money(total,op.currency)}</p>
  </div>
  {needsRate&&<p className="alert">No se pudo obtener el tipo de cambio. Escríbelo para calcular los precios en soles.</p>}
 </section>
 <div className="steps-pair">
 <section className="step"><h3><span className="step-number">4</span>{isProducer?'¿Quién recibe y cómo se descuenta?':'¿Quién recibe?'}</h3>
  <ActaFields d={resolvedDetails} producer={selectedProducer} isProducer={isProducer} parts={['recipient','discount']} onChange={patch=>setOp({...op,details:{...op.details,...patch,reviewed:''}})}/>
 </section>
 <section className="step"><h3><span className="step-number">5</span>Revisar y {op.kind==='purchase'?'confirmar':'emitir'}</h3>
  <label>Observaciones<textarea placeholder="Opcional" value={op.details.notes??''} onChange={e=>details('notes',e.target.value)}/></label>
  <div className="review-summary"><span>{kinds[op.kind]}</span><span>{isProducer?selectedProducer?.name??'Sin productor':op.kind==='transfer'?warehouses.find(w=>w.id===op.destination_id)?.name??'Sin destino':op.details.destination||'—'}</span><span>{items.length} {items.length===1?'insumo':'insumos'}</span><strong>{money(total,op.currency)}</strong></div>
  {!readonly&&(missing.length?<div className="missing"><b>Antes de {op.kind==='purchase'?'confirmar':'emitir'} falta:</b><ul>{missing.map(m=><li key={m}>{m}</li>)}</ul></div>:<p className="ready">Todo listo para {op.kind==='purchase'?'confirmar':'emitir'}.</p>)}
  {isProducer&&<label className="check"><input type="checkbox" checked={op.details.reviewed==='yes'} onChange={e=>details('reviewed',e.target.checked?'yes':'')}/>Revisé productor, cantidades y precios. Corresponden a lo que se entregó.</label>}
 </section>
 </div>
 <details className="step more"><summary>Más datos (opcional): campaña, guía y datos de FRUGLOBE</summary>
  <div className="form-grid">
   <label>Campaña<input value={op.details.campaign??''} onChange={e=>details('campaign',e.target.value)}/></label>
   <label>Referencia de origen / guía<input value={op.details.source??''} onChange={e=>details('source',e.target.value)}/></label>
  </div>
  <ActaFields d={resolvedDetails} producer={selectedProducer} isProducer={isProducer} parts={['company','extra']} onChange={patch=>setOp({...op,details:{...op.details,...patch,reviewed:''}})}/>
 </details>
 </fieldset><div className="actions step-actions">{!readonly&&<><button className="quiet" disabled={!items.length}>Guardar borrador</button><button type="button" disabled={!!missing.length} onClick={()=>run(async()=>{await save();await rpc('field_issue_operation',{p_id:op.id});await open(op.id);setPreview(true);})}>{op.kind==='historical'?'Emitir acta histórica':op.kind==='purchase'?'Confirmar ingreso':'Confirmar y emitir acta'}</button></>}<button type="button" className="quiet" onClick={()=>setPreview(!preview)}>{preview?'Ocultar acta':'Ver acta'}</button>{readonly&&<button type="button" onClick={()=>{setPreview(true);setTimeout(()=>window.print(),150);}}>Imprimir / guardar PDF</button>}</div></form>
 {readonly&&op.status!=='cancelled'&&<section className="followup"><h3>Firma y regularización NISIRA</h3><label>Documento NISIRA / referencia<input value={nisira} onChange={e=>setNisira(e.target.value)}/></label><button onClick={()=>run(async()=>{await rpc('field_set_followup',{p_id:op.id,p_reference:nisira});await open(op.id);})}>Guardar referencia</button><label>Adjuntar acta firmada (PDF, JPG o PNG; máximo 10 MB)<input type="file" accept="application/pdf,image/png,image/jpeg" onChange={e=>{const file=e.target.files?.[0];if(file)run(async()=>{if(file.size>10485760)throw new Error('El archivo supera 10 MB');if(!['application/pdf','image/png','image/jpeg'].includes(file.type))throw new Error('Usa PDF, JPG o PNG');const path=`${op.id}/${crypto.randomUUID()}.${file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':'jpg'}`;const {error}=await db().storage.from('signed-actas').upload(path,file);if(error)throw new Error(error.message);try{await rpc('field_set_followup',{p_id:op.id,p_reference:nisira,p_path:path});}catch(e){throw new Error(`El archivo se subió pero no se vinculó. Reintenta adjuntarlo. ${e instanceof Error?e.message:''}`);}await open(op.id);});}}/></label>{op.signed_path&&<button className="quiet" onClick={()=>run(async()=>{const {data,error}=await db().storage.from('signed-actas').createSignedUrl(op.signed_path!,120);if(error)throw new Error(error.message);window.open(data.signedUrl,'_blank','noopener,noreferrer');})}>Abrir acta firmada</button>}</section>}
 {op.number&&op.status!=='cancelled'&&<details className="danger-zone"><summary>Anular documento</summary><p>La anulación conserva el historial y revierte el stock cuando corresponde.</p><label>Motivo<input value={cancelReason} minLength={5} onChange={e=>setCancelReason(e.target.value)}/></label><button className="danger" disabled={cancelReason.trim().length<5} onClick={()=>run(async()=>{await rpc('field_cancel_operation',{p_id:op.id,p_reason:cancelReason});await open(op.id);setCancelReason('');})}>Anular y registrar reverso</button>{canManage&&<p className="field-help">Para eliminarlo, primero anúlalo.</p>}</details>}
 {canManage&&op.number&&['draft','cancelled'].includes(op.status)&&<details className="danger-zone"><summary>Eliminar documento (administración)</summary><p>Se borra de la lista de forma definitiva. El stock no cambia y la auditoría conserva una copia.</p><button className="danger" onClick={()=>run(()=>remove(op))}>Eliminar {code(op.number)}</button></details>}
 </section>
 <section className="card"><h3>Documentos registrados</h3><div className="filters"><label>Buscar<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Número, productor o referencia"/></label><label>Estado<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Todos</option>{Object.entries(states).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div><div className="table-wrap"><table><thead><tr><th>N.º / fecha</th><th>Tipo / productor</th><th>Estado</th><th>Total</th><th>NISIRA</th><th></th></tr></thead><tbody>{rows.filter(o=>(!filter||o.status===filter)&&`${code(o.number)} ${o.producer_snapshot?.name??producers.find(p=>p.id===o.producer_id)?.name??''} ${o.nisira_reference??''}`.toLowerCase().includes(query.toLowerCase())).map(o=><tr key={o.id}><td>{code(o.number)}<small>{o.occurred_on}</small></td><td>{kinds[o.kind]}<small>{o.producer_snapshot?.name??producers.find(p=>p.id===o.producer_id)?.name}</small></td><td><span className="pill">{states[o.status]}</span></td><td>{money(o.total??0,o.currency)}</td><td>{o.nisira_reference||'Pendiente'}</td><td><div className="row-actions"><button className="quiet" onClick={()=>run(async()=>{await open(o.id);window.scrollTo(0,0);})}>Abrir</button>{canManage&&['draft','cancelled'].includes(o.status)&&<button className="quiet danger-text" onClick={()=>run(()=>remove(o))}>Eliminar</button>}</div></td></tr>)}</tbody></table>{!rows.length&&<p>No hay documentos. Crea una salida nueva o regulariza una entrega antigua.</p>}</div></section></div>
 {preview&&active&&createPortal(<Acta op={printOp} items={enriched} warehouses={warehouses}/>,document.body)}
 </>;
}
