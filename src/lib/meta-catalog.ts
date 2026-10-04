export interface CatalogInventory {
  unitPrice: number;
  reservationMode: boolean;
  variants: { sku: string; name: string; color: string; available_stock: number }[];
}

const escapeXml = (value: string | number) => String(value).replace(/[<>&"']/g, char => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
}[char]!));

export function metaCatalogXml(inventory: CatalogInventory) {
  const items = inventory.variants.map(variant => {
    const params = new URLSearchParams({ size: variant.name, utm_source: "instagram", utm_medium: "product_tag", utm_campaign: "non_sufficit_orbis" });
    const fields: Record<string, string | number> = {
      id: variant.sku, item_group_id: "IE-CAMISETA-IMPERIAL",
      title: `NON SUFFICIT ORBIS - Primera edicion - ${variant.name}`,
      description: "Primera edicion de Imperio E inspirada en los simbolos de la Monarquia Hispanica. Reserva gratuita, sin obligacion de compra. Precio indicado con envio a Peninsula e IVA incluidos.",
      availability: inventory.reservationMode && variant.available_stock > 0 ? "preorder" : "out of stock",
      condition: "new", price: `${(inventory.unitPrice / 100).toFixed(2)} EUR`,
      link: `https://www.imperioes.com/instagram?${params}`,
      image_link: "https://imperioes.com/images/camiseta-imperio-frontal.webp",
      additional_image_link: "https://imperioes.com/images/camiseta-imperio-atras.webp",
      brand: "Imperio E", size: variant.name, color: variant.color,
      inventory: Math.max(0, variant.available_stock),
    };
    return `<item>${Object.entries(fields).map(([key, value]) => `<g:${key}>${escapeXml(value)}</g:${key}>`).join("")}</item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Imperio E</title><link>https://imperioes.com/instagram</link><description>Primera edicion NON SUFFICIT ORBIS</description>${items.join("")}</channel></rss>`;
}
