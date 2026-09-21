import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { editorialDate } from "./config/editorial";

const articles = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().min(50).max(70),
    summary: z.string(),
    date: editorialDate,
    category: z.enum(["efemeride", "ensayo", "presente"]),
    tier: z.enum(["piquero", "arcabucero", "maestre-de-campo"]),
    seoDescription: z.string().optional(),
    ogImage: z.string().optional(),
    indexable: z.boolean().default(false),
    author: z.string().optional(),
    modifiedAt: editorialDate.optional(),
  }),
});

const lanzamientos = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/lanzamientos" }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().min(50).max(70),
    summary: z.string(),
    date: z.string(),
    price: z.string(),
    status: z.enum(["active", "soldout", "comingsoon"]),
    paymentLink: z.string().optional(),
    seoDescription: z.string().optional(),
    ogImage: z.string().optional(),
    indexable: z.boolean().default(false),
  }),
});

const rutas = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/rutas" }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().min(50).max(70),
    summary: z.string(),
    intro: z.string(),
    items: z
      .array(
        z.object({
          title: z.string(),
          slug: z.string(),
        })
      )
      .optional(),
    seoDescription: z.string().optional(),
    ogImage: z.string().optional(),
    indexable: z.boolean().default(false),
  }),
});

export const collections = { articles, lanzamientos, rutas };
