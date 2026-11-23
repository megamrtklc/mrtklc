import assert from 'node:assert/strict';
import { normalizePersonName } from '../scripts/person-name.mjs';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

assert.equal(normalizePersonName('Abdullah Oğuz'), 'abdullah oguz');
assert.equal(normalizePersonName('Onur Böber'), 'onur bober');
assert.notEqual(normalizePersonName('Abdullah Oğuz'), normalizePersonName('Onur Böber'), 'Farklı Türkçe isimler aynı kişiye dönüşmemeli');
assert.equal(normalizePersonName('Hwang Dong-hyuk'), 'hwang dong hyuk');
const temp = await mkdtemp(path.join(os.tmpdir(), 'perde-seo-'));
try {
  const catalogPath = path.join(temp, 'fixture.json');
  const outputPath = path.join(temp, 'site');
  await mkdir(outputPath, { recursive: true });
  await writeFile(catalogPath, JSON.stringify({ catalog: [
    { id:'film-1', title:'Şahsiyet', type:'movie', year:2018, desc:'Agâh Beyoğlu adında emekli bir adliye memurunun hikâyesi.', poster:'https://example.com/sahsiyet.jpg', tmdbId:123, tmdbGenres:'Suç / Dram', tmdbRating:'8.2', tmdbVoteCount:100, tmdbDirector:'Onur Saylak', tmdbCast:[{id:77,name:'Haluk Bilginer',character:'Agâh',profile:'https://example.com/haluk.jpg'},{id:89,name:'Oyuncu Üç'},{id:90,name:'Oyuncu Dört'},{id:91,name:'Oyuncu Beş'},{id:88,name:'Tek Yapımlık Oyuncu',character:'Konuk'},{id:92,name:'Oyuncu Altı'},{id:93,name:'Yedinci Oyuncu'}] },
    { id:'series-1', title:'Şahsiyet', type:'tv', year:2018, desc:'Bir mini dizi.', tmdbDirector:'Onur Saylak', tmdbCast:[{id:77,name:'Haluk Bilginer',character:'Agâh'}] },
    { id:'film-2', title:'Kış Uykusu', type:'movie', year:2014, desc:'Bir otel işletmecisinin hikâyesi.', tmdbDirector:'Nuri Bilge Ceylan', tmdbCast:[{id:99,name:'Tek Yapım Başrolü',character:'Başrol'}] }
  ] }, null, 2));
  const result = spawnSync(process.execPath, ['scripts/build-seo-pages.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, SEO_TMDB_API_KEY:'', SEO_CATALOG_FILE:catalogPath, SEO_OUTPUT_DIR:outputPath, SEO_SITE_URL:'https://example.test', SEO_BASE_PATH:'/perde' }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const film = await readFile(path.join(outputPath,'film/sahsiyet.html'),'utf8');
  const series = await readFile(path.join(outputPath,'dizi/sahsiyet.html'),'utf8');
  const actor = await readFile(path.join(outputPath,'oyuncu/haluk-bilginer.html'),'utf8');
  const director = await readFile(path.join(outputPath,'yonetmen/onur-saylak.html'),'utf8');
  const sitemap = await readFile(path.join(outputPath,'sitemap.xml'),'utf8');
  const robots = await readFile(path.join(outputPath,'robots.txt'),'utf8');
  const watch = await readFile(path.join(outputPath,'izle/sahsiyet-film-1.html'),'utf8');
  assert.match(film, /<title>Şahsiyet \(2018\) \| Perde<\/title>/);
  assert.match(film, /application\/ld\+json/);
  assert.equal((film.match(/class="person"/g) || []).length, 6, 'Yapım sayfasında en fazla 6 oyuncu görünmeli');
  assert.ok(film.includes('/perde/izle/sahsiyet-film-1.html'));
  assert.ok(watch.includes('noindex,follow'));
  assert.ok(watch.includes('window.location.replace'));
  assert.ok(watch.includes('#/watch/film-1'));
  assert.match(film, /Tek Yapımlık Oyuncu/, 'Tek yapımlık oyuncu ilk 6 içindeyse kadroda görünmeli');
  assert.doesNotMatch(film, /Yedinci Oyuncu/, 'Yedinci oyuncu gösterilmemeli');
  await assert.rejects(readFile(path.join(outputPath,'oyuncu/tek-yapimlik-oyuncu.html'),'utf8'));
  const leadActor = await readFile(path.join(outputPath,'oyuncu/tek-yapim-basrolu.html'),'utf8');
  assert.match(leadActor, /Tek Yapım Başrolü/, 'Tek yapımda ilk 3 sıradaki oyuncunun profili oluşturulmalı');
  assert.match(film, /https:\/\/example\.test\/perde\/film\/sahsiyet\.html/);
  assert.match(series, /TVSeries/);
  assert.match(actor, /Haluk Bilginer/);
  assert.ok(actor.includes('/perde/#/actor/77'), 'Oyuncu profili uygulamadaki TMDB profil rotasına bağlanmalı');
  assert.match(director, /Nuri Bilge Ceylan|Onur Saylak/);
  assert.equal(director.includes('#/director/'), false, 'TMDB kimliği doğrulanmadan uygulama profiline bağlantı eklenmemeli');
  assert.match(sitemap, /https:\/\/example\.test\/perde\/film\/sahsiyet\.html/);
  assert.match(robots, /Sitemap: https:\/\/example\.test\/perde\/sitemap\.xml/);
  const manifest = JSON.parse(await readFile(path.join(outputPath,'.seo-generated-files.json'),'utf8'));
  assert.equal(manifest.length, 12);
  console.log('PASS: SEO sayfa üretimi, slug çakışması, canonical, JSON-LD, sitemap ve robots.txt');
} finally {
  await rm(temp, { recursive:true, force:true });
}
