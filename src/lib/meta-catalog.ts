import { SHIRT_SHIPPING_PRICE_CENTS } from "../config/commerce";

export interface CatalogInventory {
  unitPrice: number;
  reservationMode: boolean;
  salesEnabled?: boolean;
  variants: { sku: string; name: string; color: string; available: boolean }[];
}

const escapeXml = (value: string | number) => String(value).replace(/[<>&"']/g, char => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
}[char]!));

export function metaCatalogXml(inventory: CatalogInventory) {
  const items = inventory.variants.map(variant => {
    const params = new URLSearchParams({ size: variant.name, utm_source: "instagram", utm_medium: "product_tag", utm_campaign: "non_sufficit_orbis" });
    const fields: Record<string, string | number> = {
      id: variant.sku, item_group_id: "IE-CAMISETA-IMPERIAL",
      title: `Camiseta Imperial - NON SUFFICIT ORBIS - ${variant.name}`,
      description: `Primera edicion de Imperio E inspirada en los simbolos de la Monarquia Hispanica. ${inventory.salesEnabled ? "Compra con pago seguro en Stripe, sin crear una cuenta." : inventory.reservationMode ? "Reserva gratuita, sin obligacion de compra." : "Compra no disponible temporalmente."} IVA incluido. Envio a Peninsula: 3 EUR por camiseta. Total con envio: ${((inventory.unitPrice + SHIRT_SHIPPING_PRICE_CENTS) / 100).toFixed(2)} EUR por unidad.`,
      availability: variant.available ? inventory.salesEnabled ? "in stock" : inventory.reservationMode ? "preorder" : "out of stock" : "out of stock",
      condition: "new", price: `${(inventory.unitPrice / 100).toFixed(2)} EUR`,
      link: `https://imperioes.com/instagram?${params}`,
      image_link: "https://imperioes.com/images/camiseta-imperio-frontal.webp",
      additional_image_link: "https://imperioes.com/images/camiseta-imperio-atras.webp",
      brand: "IMPERIO ESPA\u00d1OL",
      google_product_category: "Apparel & Accessories > Clothing > Shirts & Tops",
      size: variant.name, color: variant.color,
    };
    return `<item>${Object.entries(fields).map(([key, value]) => `<g:${key}>${escapeXml(value)}</g:${key}>`).join("")}</item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Imperio Espa\u00f1ol</title><link>https://imperioes.com/instagram</link><description>Primera edicion NON SUFFICIT ORBIS</description>${items.join("")}</channel></rss>`;
}
