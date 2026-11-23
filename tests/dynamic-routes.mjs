import assert from "node:assert/strict";
import worker from "../worker/index.mjs";

const catalog = { catalog: [
  { id:"m1", title:"Şahsiyet", type:"movie", year:2018, desc:"Agâh Beyoğlu'nun hikâyesi.", poster:"https://example.test/poster.jpg", tmdbId:123, tmdbGenres:"Suç / Dram", tmdbRating:"8.2", tmdbVoteCount:100, tmdbDirector:"Onur Saylak", tmdbCast:[
    {id:77,name:"Haluk Bilginer",character:"Agâh",profile:"https://example.test/haluk.jpg"},
    {id:89,name:"Oyuncu İki"},{id:90,name:"Oyuncu Üç"},{id:91,name:"Oyuncu Dört"},{id:92,name:"Oyuncu Beş"},{id:93,name:"Oyuncu Altı"},{id:94,name:"Yedinci Oyuncu"}
  ] },
  { id:"s1", title:"Şahsiyet", type:"tv", year:2018, desc:"Mini dizi.", tmdbDirector:"Onur Saylak", tmdbCast:[{id:77,name:"Haluk Bilginer",character:"Agâh"}] },
  { id:"m2", title:"Kış Uykusu", type:"movie", year:2014, tmdbDirector:"Nuri Bilge Ceylan", tmdbCast:[{id:99,name:"Tek Yapımlık Başrol",character:"Aydın"}] }
]};
const env = { ASSETS: { fetch: async (request) => new Response(JSON.stringify(catalog), { headers:{"content-type":"application/json"} }) } };
async function get(path) { return worker.fetch(new Request("https://mrtsinema.test" + path),env); }
let res = await get("/film/sahsiyet/");
assert.equal(res.status,200);
let html = await res.text();
assert.match(html,/<title>Şahsiyet \(2018\) \| MRTSINEMA<\/title>/);
assert.match(html,/application\/ld\+json/);
assert.equal((html.match(/class="person"/g)||[]).length,6);
assert.match(html,/https:\/\/mrtsinema\.test\/film\/sahsiyet\//);
res = await get("/dizi/sahsiyet/");
assert.equal(res.status,200);
assert.match(await res.text(),/TVSeries/);
res = await get("/oyuncu/haluk-bilginer/");
assert.equal(res.status,200);
html = await res.text();
assert.match(html,/Canlandırdığı karakter: Agâh/);
assert.match(html,/#\/actor\/77/);
res = await get("/yonetmen/onur-saylak/");
assert.equal(res.status,200);
assert.match(await res.text(),/Nuri Bilge Ceylan|Onur Saylak/);
res = await get("/film/sahsiyet.html");
assert.equal(res.status,301);
assert.equal(res.headers.get("location"),"https://mrtsinema.test/film/sahsiyet/");
res = await get("/sitemap.xml");
assert.equal(res.status,200);
assert.match(await res.text(),/https:\/\/mrtsinema\.test\/oyuncu\/haluk-bilginer\//);
res = await get("/robots.txt");
assert.match(await res.text(),/Sitemap: https:\/\/mrtsinema\.test\/sitemap\.xml/);
console.log("PASS: dynamic SEO routes, canonical, JSON-LD, six-person cast, legacy redirects and sitemap");
