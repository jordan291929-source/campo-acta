import type {Line,Operation,Warehouse} from './model';
import {code,fmt,money,kinds,packageLabel} from './model';
const blank='________________________________';
export function Acta({op,items,warehouses}:{op:Operation;items:Line[];warehouses:Warehouse[]}){
 const d=op.details,p=op.producer_snapshot,producer=op.kind==='delivery'||op.kind==='historical';
 const value=(s?:string)=>s||blank;
 return <article className="acta"><div className="acta-heading"><b>FRUGLOBE S.A.C.</b><span>RUC {value(d.company_ruc)}</span></div>
 <h1>{producer?'Acta de entrega y recepción de insumos agrícolas':kinds[op.kind]}</h1>
 <p><b>{code(op.number)}</b> · {op.status==='draft'?'BORRADOR · SIN FIRMA':op.status==='cancelled'?'ANULADA':'DOCUMENTO EMITIDO'}<br/>Lugar: {value(d.place)} · Fecha de entrega física: {op.occurred_on}<br/>Fecha de emisión: {op.issued_at?new Date(op.issued_at).toLocaleDateString('es-PE',{timeZone:'America/Lima'}):'Pendiente'}{op.kind==='historical'&&<><br/><b>Regularización documental de una entrega anterior. No genera una nueva salida de stock.</b></>}</p>
 {op.status==='cancelled'&&<p><b>Motivo de anulación: {op.cancellation_reason}</b></p>}
 {producer&&<p>Las partes identificadas a continuación dejan constancia de los insumos entregados por FRUGLOBE S.A.C. al productor, de su valor y de las condiciones acordadas para su pago. Completar todos los campos aplicables y anular los espacios no utilizados.</p>}
 <h2>1. Identificación de las partes y destino</h2>
 <p>Empresa: FRUGLOBE S.A.C. · RUC: {value(d.company_ruc)}<br/>Domicilio: {value(d.company_address)}<br/>Representante: {value(d.representative_name||d.responsible)} · DNI/CE: {value(d.representative_document)}<br/>Cargo y sustento de facultades: {value(d.authority)}</p>
 {producer?<p>Productor o razón social: {value(p?.name)}<br/>DNI/CE: {value(p?.document?.length===11?'':p?.document)} · RUC: {value(p?.details?.ruc||(p?.document?.length===11?p.document:''))}<br/>Domicilio: {value(p?.details?.address)}<br/>Teléfono: {value(p?.details?.phone)} · Correo: {value(p?.details?.email)}<br/>Predio y código: {value(p?.predio)} · Campaña: {value(d.campaign)}<br/>Ubicación del predio: {value(p?.details?.location)}<br/>Lugar de entrega: {value(d.place)} · Contrato vinculado N.º: {value(d.contract)}</p>:<p>Destino / fundo / proveedor: {value(d.destination)}<br/>Responsable que recibe: {value(d.receiver)}<br/>Campaña: {value(d.campaign)}</p>}
 <p>Ubicación de {op.kind==='purchase'?'ingreso':'origen'}: {warehouses.find(w=>w.id===op.warehouse_id)?.name}{op.kind==='transfer'&&<><br/>Ubicación de destino: {warehouses.find(w=>w.id===op.destination_id)?.name}</>}</p>
 <p>Responsable de la entrega / registro: {value(d.responsible)}</p>
 <h2>2. Insumos entregados y valorización</h2>
 <table><thead><tr><th>Descripción / presentación</th><th>Cantidad</th><th>Unidad</th><th>Precio unitario ({op.currency})</th><th>Total ({op.currency})</th></tr></thead><tbody>{items.map(l=><tr key={l.product_id}><td>{l.product_name}<small>{l.presentation}</small></td><td>{fmt(l.quantity)}</td><td>{packageLabel(l.presentation,l.unit)}</td><td>{money(l.price,op.currency)}</td><td>{money(Math.round((l.quantity*l.price+Number.EPSILON)*100)/100,op.currency)}</td></tr>)}</tbody></table>
 <p className="acta-total">PRECIO TOTAL DE LA ENTREGA: {money(op.total??0,op.currency)}</p>
 {op.currency==='PEN'&&d.exchange_rate&&<p>Tipo de cambio referencial: S/ {d.exchange_rate} por USD{d.exchange_rate_date?`, consultado el ${d.exchange_rate_date}`:''}. Precios en dólares convertidos a soles.</p>}
 <p>Comprobante: {value(d.receipt)} · Referencia de origen: {value(d.source)}</p>
 <h2>3. Conformidad de la recepción física</h2>
 <p>{producer?'El productor declara haber verificado la descripción, las cantidades y el estado aparente de los insumos, según el detalle de la sección 2 y sus anexos.':'El responsable receptor deja constancia de la recepción de los insumos detallados.'} La recepción se realiza: □ Conforme □ Con observaciones consignadas abajo. Los insumos rechazados o no entregados deberán excluirse del total antes de firmar. La conformidad física no impide comunicar defectos no apreciables al recibir ni ejercer los derechos que correspondan.</p>
 <p>Observaciones y medidas acordadas: {value(d.notes)}</p>
 {producer&&<><h2>4. Reconocimiento de la obligación de pago</h2>
 <p>El productor reconoce a favor de FRUGLOBE S.A.C. la obligación de pagar el valor de los insumos efectivamente recibidos y aceptados. Total de entrega: {money(op.total??0,op.currency)}; con fecha {op.occurred_on}; SALDO INICIAL DE DEUDA: {value(d.initial_debt)}.</p>
 <h2>5. Autorización expresa de descuento</h2>
 <p>El productor autoriza expresamente a FRUGLOBE S.A.C. a aplicar descuentos para pagar exclusivamente el saldo de esta acta sobre los importes que la empresa deba abonarle por sus liquidaciones de palta del predio y campaña indicados. Esta autorización alcanza solo créditos del productor frente a FRUGLOBE S.A.C. y no permite afectar créditos de terceros.</p>
 <p>Se descontará el 100 % del importe disponible de cada liquidación hasta cancelar íntegramente la deuda pendiente, sin fraccionamiento voluntario ni porcentajes parciales de descuento. El descuento no excederá el saldo adeudado. Inicio: {value(d.discount_start)} · Fin de campaña previsto: {value(d.campaign_end)}.</p>
 <p>El importe disponible es el saldo a favor del productor después de las deducciones legales y de las deducciones contractuales previamente pactadas y detalladas en la liquidación. Cada descuento será el menor entre el importe disponible y la deuda pendiente. FRUGLOBE S.A.C. mostrará en cada liquidación el número de esta acta, saldo anterior, descuento aplicado y saldo restante, y entregará copia al productor por: {value(d.copy_channel)}. Los pagos directos y ajustes documentados se registrarán antes del siguiente descuento para evitar cobros duplicados.</p>
 <h2>6. Insuficiencia de liquidaciones y pago del remanente</h2>
 <p>Si una liquidación resulta insuficiente, el saldo continuará pendiente y se aplicará a las siguientes liquidaciones de la campaña bajo la misma regla. El productor pagará cualquier remanente, aun si no entrega fruta o no se generan liquidaciones, a más tardar el {value(d.due_date)}. No se trasladará automáticamente el descuento a otras campañas; ello requerirá acuerdo escrito de ambas partes.</p>
 <p>Medio de pago: {value(d.payment_method)} · Banco y titular: {value(d.bank)}<br/>Cuenta o CCI de FRUGLOBE S.A.C.: {value(d.account)}<br/>Referencia y canal para enviar constancia: {value(d.payment_channel)}</p>
 <p>Esta acta no pacta intereses, penalidades ni gastos adicionales. Cualquier modificación del plazo o acuerdo adicional deberá constar por escrito, firmado por ambas partes y sujeto a los límites legales aplicables.</p></>}
 {!producer&&<p>Movimiento interno. Este documento no genera una obligación de pago de un productor.</p>}
 <p>Leída el acta y completados sus campos, las partes aceptan lo consignado y firman dos ejemplares de igual contenido. Toda corrección debe quedar salvada con las iniciales de ambas partes.</p>
 <div className="signatures"><div><b>Por FRUGLOBE S.A.C.</b><p>Firma: {blank}<br/>Nombre: {value(d.representative_name||d.responsible)}<br/>DNI/CE: {value(d.representative_document)}</p></div><div><b>{producer?'Productor o representante acreditado':'Responsable que recibe'}</b><p>Firma: {blank}<br/>Nombre: {value(d.receiver||p?.name)}<br/>DNI/CE: {value(d.receiver_document||p?.document)}</p></div></div>
 </article>;
}
