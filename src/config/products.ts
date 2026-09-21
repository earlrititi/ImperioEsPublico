import { LEGAL_BUSINESS } from "./legal";
import { SHIRT_FINAL_PRICE_CENTS } from "./commerce";

const shirtVariants = [
  { size: "S", stock: 3, lengthCm: 66, widthCm: 50 },
  { size: "M", stock: 15, lengthCm: 69, widthCm: 53 },
  { size: "L", stock: 16, lengthCm: 72, widthCm: 56 },
  { size: "XL", stock: 8, lengthCm: 75, widthCm: 59 },
  { size: "XXL", stock: 3, lengthCm: 78, widthCm: 62 },
] as const;

export const PRODUCTS = {
  "camiseta-imperial": {
    slug: "camiseta-imperial",
    name: "Camiseta Imperial",
    sku: "IE-CAMISETA-IMPERIAL",
    baseGarmentBrand: "VALENTO",
    color: "Blanco / negro - Diseno Imperial",
    baseGarmentModel: "Valento BRICKPLUS",
    manufacturerReference: "CAVABRI",
    baseGarmentFeatures: [
      "Camiseta tecnica de manga corta, cuello redondo y diseno bicolor.",
      "Tejido transpirable Bird-Eye de secado rapido que facilita la evacuacion del sudor.",
      "Costuras planas en hombros y axilas para reducir el roce.",
    ],
    baseGarmentDecorationMethods: ["sublimacion", "serigrafia", "transfer", "vinilo", "bordado", "cosido"],
    priceEnvName: "STRIPE_PRICE_CAMISETA_IMPERIAL",
    expectedUnitAmount: SHIRT_FINAL_PRICE_CENTS,
    currency: "eur",
    // Owner-supplied snapshot, not an inventory reservation or a live stock feed.
    stock: shirtVariants.reduce((total, variant) => total + variant.stock, 0),
    stockSource: "tabla_simple_ventas_camisetas.xlsx - Ventas camisetas!A6:D10",
    variants: shirtVariants.map((variant) => variant.size),
    variantDetails: shirtVariants,
    composition: [{ fibre: "poliester", percentage: 100 }],
    fabricWeightGsm: 145,
    fabric: "Tejido tecnico transpirable Bird-Eye",
    careInstructions: "Lavado a un maximo de 30 grados. No usar lejia. No planchar. No limpiar en seco. No usar secadora.",
    technicalSheetSource: "ficha tecnica valento.pdf",
    manufacturerSourceUrl: "https://valento.es/productos/camisetas-tecnicas/camiseta-tecnica-BRICKPLUS",
    manufacturer: LEGAL_BUSINESS.manufacturer,
    manufacturerAddress: LEGAL_BUSINESS.manufacturerAddress,
    manufacturerEmail: LEGAL_BUSINESS.manufacturerEmail,
    manufacturerPhone: "+34 976 595 758",
    euResponsiblePerson: LEGAL_BUSINESS.euResponsiblePerson,
    safetyInformation: null,
    shipping: {
      country: "ES",
      region: "ES_MAINLAND",
      carrier: "Correos",
      amount: 0,
      preparationMaxHours: 48,
      deliveryMaxBusinessDays: 7,
    },
    shippingInformation: "Envio estandar por Correos incluido, solo a la Peninsula espanola. Tras confirmar el pago: preparacion maxima de 48 horas y entrega maxima de 7 dias laborables.",
    tax: { percentage: 21, behavior: "inclusive", confirmedByOwner: true },
    taxInformation: "IVA del 21 % incluido en el precio de la camiseta.",
    packagingType: "Sobre de envio",
    packagingProvider: "Correos",
    packagingCompliance: "CARRIER_PROVIDED_ARTICLE_17_5_CONFIRMED",
    legalStatus: "LEGAL_PRODUCT_DATA_INCOMPLETE",
  },
} as const;

export type ProductSlug = keyof typeof PRODUCTS;

export function getProduct(input: unknown) {
  if (typeof input !== "string" || !Object.hasOwn(PRODUCTS, input)) {
    return null;
  }

  return PRODUCTS[input as ProductSlug];
}
