import type { APIRoute } from "astro";
import { adminDashboardExport, adminDashboardGet } from "../../../lib/admin-communications";
export const prerender = false;
export const GET: APIRoute = context => adminDashboardGet(context, true);
export const POST: APIRoute = context => adminDashboardExport(context, true);
