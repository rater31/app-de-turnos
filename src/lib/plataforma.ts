// Configuración de la plataforma (cobro del plan Pro).
//
// TODO(MP): Mercado Pago todavía NO está integrado (no hay Checkout Pro ni
// Planes, ver el paquete `mercadopago` en package.json que no se importa en
// ningún lado). El cobro del plan es por transferencia manual y un humano valida
// el comprobante desde /admin/pagos.
//
// Antes se intentaba leer el CBU del tenant del superadmin, pero la RLS de
// `profiles` solo deja ver la propia fila, así que la página de pago nunca
// encontraba los datos y le mostraba "contactá al administrador" al único
// usuario que debía verla. Cuando se integre MP, esto pasa a salir de la API y
// este archivo desaparece.
//
// Los datos de abajo son reales y hay que manterlos actualizados a mano si la
// cuenta cambia. El alias es la clave: no le agregues acentos ni espacios.

export const PLAN_PRICE = 8000;

export const PLAN_BANK = {
  alias_cbu: "fede.h.95",
  banco: "Mercado Pago",
  titular: "Federico Adrian Hidalgo",
};
