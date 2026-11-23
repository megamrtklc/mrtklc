const BASE = process.env.DYNAMIC_SITE_URL || "https://mrtsinema-dynamic.megamrtklc.workers.dev";
const sitemapResponse = await fetch(BASE + "/sitemap.xml", { signal: AbortSignal.timeout(20000) });
if (!sitemapResponse.ok) throw new Error("Sitemap HTTP " + sitemapResponse.status);
const xml = await sitemapResponse.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (!urls.length) throw new Error("Sitemap boş.");
const failures = [];
let cursor = 0;
const worker = async () => {
  while (cursor < urls.length) {
    const url = urls[cursor++];
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20000) });
      if (response.status !== 200) {
        failures.push(url + " → HTTP " + response.status);
        continue;
      }
      const html = await response.text();
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      if (canonical !== url) failures.push(url + " → canonical uyuşmuyor: " + (canonical || "yok"));
      if (!html.includes('name="robots" content="noindex,nofollow"')) failures.push(url + " → staging noindex etiketi eksik");
      if (!/<title>[^<]+<\/title>/.test(html)) failures.push(url + " → title eksik");
    } catch (error) {
      failures.push(url + " → " + (error?.message || String(error)));
    }
  }
};
await Promise.all(Array.from({ length: 12 }, worker));
console.log("Kontrol edilen dinamik sayfa: " + urls.length);
if (failures.length) {
  console.error("Başarısız sayfa: " + failures.length);
  for (const failure of failures.slice(0, 30)) console.error(failure);
  process.exitCode = 1;
} else {
  console.log("PASS: sitemap içindeki tüm sayfalar HTTP 200, doğru canonical, title ve noindex etiketi veriyor.");
}
