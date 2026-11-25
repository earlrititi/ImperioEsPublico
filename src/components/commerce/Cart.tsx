import { useEffect, useState } from "preact/hooks";
import { changeCart, readCart, saveCart, type CartItem } from "../../lib/cart";
import { formatMoney, SHIRT_PRODUCT_PRICE_CENTS } from "../../config/commerce";
import { attributedPath } from "../../lib/social-attribution";
import { trackAutomationActivity, trackGoogleCommerce } from "../../lib/google-analytics";

export default function Cart() {
  const [items, setItems] = useState<CartItem[]>([]), [ready, setReady] = useState(false), [error, setError] = useState("");
  const [unitPrice, setUnitPrice] = useState(SHIRT_PRODUCT_PRICE_CENTS);
  useEffect(() => {
    let active = true;
    const refreshPrice = async () => {
      try { const response = await fetch("/api/reservations/inventory", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (active && Number.isSafeInteger(data.unitPrice) && data.unitPrice > 0) setUnitPrice(data.unitPrice);
      } catch { /* Recheck price before checkout. */ }
    };
    void refreshPrice(); const timer = window.setInterval(refreshPrice, 5000);
    const sync = () => { setItems(readCart()); setReady(true); };
    sync(); window.addEventListener("imperio:cart", sync);
    let measured = false;
    const measure = () => { if (!measured) measured = trackGoogleCommerce("view_cart", readCart()); };
    measure(); window.addEventListener("imperio:cookie-consent", measure);
    return () => { active = false; clearInterval(timer); window.removeEventListener("imperio:cart", sync); window.removeEventListener("imperio:cookie-consent", measure); };
  }, []);
  function update(item: CartItem, quantity: number) {
    try {
      const next = changeCart(items, item.size, quantity);
      saveCart(next); setItems(next); setError("");
      const delta = quantity - item.quantity;
      if (delta) trackGoogleCommerce(delta > 0 ? "add_to_cart" : "remove_from_cart", [{ size: item.size, quantity: Math.abs(delta) }]);
      if (!next.length) trackAutomationActivity("cart_cleared");
    } catch { setError("Revisa la cantidad. No se pudo actualizar el carrito."); }
  }
  if (!ready) return <p role="status">Cargando carrito...</p>;
  if (!items.length) return <section><h2>Tu carrito está vacío</h2><a class="btn btn-primary" href="/tienda">Ver Camiseta Imperial</a></section>;
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  return <section class="cart-content">
    {items.map(item => <article class="cart-line" key={item.size}>
      <img src="/images/camiseta-imperio-frontal-640.webp" alt="Camiseta Imperial" width="80" height="100" />
      <div><h2>Camiseta Imperial</h2><p>Talla {item.size} · {formatMoney(unitPrice)} por unidad</p>
        <label>Cantidad <input aria-label={`Cantidad de talla ${item.size}`} type="number" min="1" step="1" value={item.quantity} onInput={e => { const value=Number(e.currentTarget.value); if(value>=1)update(item,value);else setError("La cantidad minima es una unidad."); }} /></label>
        <button class="btn btn-ghost" type="button" onClick={() => update(item, 0)}>Eliminar talla {item.size}</button>
      </div><strong>{formatMoney(unitPrice * item.quantity)}</strong>
    </article>)}
    <dl class="cart-totals">
      <div><dt>Subtotal (IVA incluido)</dt><dd><strong>{formatMoney(unitPrice * units)}</strong></dd></div>
      <div><dt>Envío</dt><dd>Se elige al finalizar la compra</dd></div>
    </dl>
    <p>Compra como invitado, sin crear una cuenta. Si ya eres suscriptor, tu descuento se comprueba al pagar.</p>
    {error && <p role="alert">{error}</p>}
    <div class="cart-actions"><a class="btn btn-ghost" href="/tienda">Seguir comprando</a><a class="btn btn-primary" href={attributedPath("/reservas?cart=1")} onClick={()=>trackGoogleCommerce("begin_checkout",items)}>Finalizar compra</a></div>
  </section>;
}
