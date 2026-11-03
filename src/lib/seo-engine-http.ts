import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import { createHash } from "node:crypto";
import { parse } from "parse5";

const blocked = new BlockList();
for (const [ip, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) blocked.addSubnet(ip, prefix, "ipv4");
blocked.addSubnet("2001::", 23, "ipv6");
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addSubnet("2002::", 16, "ipv6");
export function isPublicAddress(ip: string) {
  if (isIP(ip) === 4) return !blocked.check(ip, "ipv4");
  return isIP(ip) === 6 && /^[23][0-9a-f]{3}:/i.test(ip) && !blocked.check(ip, "ipv6");
}
export const SOURCE_HOSTS = ["pares.cultura.gob.es", "pares.mcu.es", "cultura.gob.es", "bne.es", "bdh.bne.es", "cervantesvirtual.com", "bibliotecavirtual.defensa.gob.es", "revistas.csic.es", "dialnet.unirioja.es", "realacademiahistoria.es", "dbe.rah.es"];
export function publicUrl(value: string, allowedHosts?: string[]) {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443") || isIP(u.hostname) || !u.hostname.includes(".") || /\.(?:local|internal|localhost|test|invalid)$/i.test(u.hostname)) throw Error("UNSAFE_URL");
  if (allowedHosts && !allowedHosts.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`))) throw Error("SOURCE_HOST_NOT_ALLOWED");
  return u;
}
export async function readPublicPage(value: string, allowedHosts?: string[], hops = 0): Promise<{ url: string; status: number; html: string; text: string; digest: string }> {
  const url = publicUrl(value, allowedHosts);
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw Error("UNSAFE_ADDRESS");
  const pinned = addresses[0];
  const response = await new Promise<{ status: number; location?: string; body: string }>((resolve, reject) => {
    const req = request(url, { method: "GET", family: pinned.family, signal: AbortSignal.timeout(15000), headers: { "User-Agent": "ImperioE-EditorialAudit/1.0 (+https://imperioes.com/politica-editorial)", Accept: "text/html,text/plain" },
      // Pin the validated address to prevent DNS rebinding between validation and connection.
      lookup: (_host, _opts, cb) => cb(null, pinned.address, pinned.family),
    }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) { res.resume(); resolve({ status: res.statusCode, location: res.headers.location, body: "" }); return; }
      if (!/^(text\/html|text\/plain|application\/xhtml\+xml)/i.test(String(res.headers["content-type"]))) { res.resume(); reject(Error("SOURCE_CONTENT_TYPE")); return; }
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", chunk => { size += chunk.length; if (size > 1024 * 1024) { res.destroy(); reject(Error("SOURCE_TOO_LARGE")); } else chunks.push(Buffer.from(chunk)); });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", () => reject(Error("SOURCE_UNAVAILABLE")));
    });
    req.setTimeout(12000, () => req.destroy(Error("SOURCE_TIMEOUT")));
    req.on("error", () => reject(Error("SOURCE_UNAVAILABLE"))); req.end();
  });
  if (response.location) { if (hops >= 3) throw Error("SOURCE_REDIRECT_LIMIT"); return readPublicPage(new URL(response.location, url).href, allowedHosts, hops + 1); }
  if (response.status !== 200) throw Error(`SOURCE_HTTP_${response.status}`);
  const text = htmlText(response.body);
  return { url: url.href, status: response.status, html: response.body, text, digest: createHash("sha256").update(text).digest("hex") };
}
type HtmlNode = { nodeName: string; value?: string; attrs?: { name: string; value: string }[]; childNodes?: HtmlNode[] };
export function htmlText(html: string): string {
  const walk = (n: HtmlNode): string => ["script", "style", "noscript"].includes(n.nodeName) ? "" : n.nodeName === "#text" ? n.value ?? "" : (n.childNodes ?? []).map(walk).join(" ");
  return walk(parse(html)).replace(/\s+/g, " ").trim();
}
export function htmlLinks(html: string, base: string) {
  const links: { url: string; rel: string; text: string }[] = [];
  const walk = (n: HtmlNode) => { if (n.nodeName === "a") { const attrs = Object.fromEntries((n.attrs ?? []).map(a => [a.name, a.value])); if (attrs.href) try { links.push({ url: new URL(attrs.href, base).href, rel: attrs.rel ?? "", text: htmlText((n.childNodes ?? []).map(c => c.value ?? "").join(" ")) }); } catch { /* Ignore malformed anchors. */ } } for (const child of n.childNodes ?? []) walk(child); };
  walk(parse(html)); return links;
}
