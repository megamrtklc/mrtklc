import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');

function has(pattern, message) {
  assert.match(js, pattern, message);
}

// The shared persistence path must serialize writes, preserve the GitHub SHA,
// handle stale-write conflicts, and restore the saving lock after every result.
const persistStart = js.indexOf('async function persist(');
const persistEnd = js.indexOf('\n  const BRAND_DEFAULTS', persistStart);
const persistBody = js.slice(persistStart, persistEnd);
assert.ok(
  persistStart >= 0 && persistEnd > persistStart &&
  persistBody.includes('if(!canWrite()||state.saving)return false;') &&
  persistBody.includes("fetch('/api/catalog',{method:'PUT',credentials:'same-origin'") &&
  persistBody.includes('body:JSON.stringify({data:nextData,sha:state.sha})') &&
  persistBody.includes('response.status===409') &&
  persistBody.includes('if(!response.ok)') &&
  persistBody.includes('finally{state.saving=false;}'),
  'Katalog kayıt akışı güvenli ve çakışma kontrollü olmalı'
);

// Create/update flows must validate input and persist through the same API path.
for (const [name, marker] of [
  ['saveContent', /if\(!record\.title\)[\s\S]*?findDuplicateContent[\s\S]*?persist\(nextData/],
  ['saveFranchise', /selected\.length<2[\s\S]*?if\(!title\)[\s\S]*?persist\(nextData/],
  ['saveCollection', /if\(!record\.title\)[\s\S]*?persist\(nextData/],
  ['saveHeaderFooter', /collectHeaderFooterDraft\(\)[\s\S]*?persist\(\{\.\.\.state\.data,headerConfig/],
  ['saveWatchLayout', /if\(!watchLayoutDirty\)return[\s\S]*?persist\(\{\.\.\.state\.data,watchPageConfig/],
  ['saveHomepageLayout', /homepageLayoutChanges\(\)[\s\S]*?persist\(\{\.\.\.state\.data,homepageConfig/]
]) {
  const start = js.indexOf('async function ' + name + '(');
  assert.notEqual(start, -1, name + ' async kayıt fonksiyonu bulunmalı');
  const next = js.indexOf('\n  async function ', start + 1);
  const body = js.slice(start, next < 0 ? js.length : next);
  assert.match(body, marker, name + ' doğrulama ve kayıt akışını korumalı');
}

// Destructive actions require explicit confirmation and must use persist().
for (const [name, confirmation] of [
  ['deleteContent', /confirm\([\s\S]*?persist\(nextData/],
  ['deleteFranchise', /confirm\([\s\S]*?persist\(/],
  ['deleteCollection', /confirm\([\s\S]*?persist\(/]
]) {
  const start = js.indexOf('async function ' + name + '(');
  assert.notEqual(start, -1, name + ' silme fonksiyonu bulunmalı');
  const next = js.indexOf('\n  async function ', start + 1);
  const body = js.slice(start, next < 0 ? js.length : next);
  assert.match(body, confirmation, name + ' silme öncesi onay almalı ve kalıcı kayıt yapmalı');
}

// Verify the visible forms/buttons are actually wired to their action handlers.
for (const binding of [
  /#content-form'\)\.addEventListener\('submit',saveContent\)/,
  /#franchise-form'\)\.addEventListener\('submit',saveFranchise\)/,
  /#collection-form'\)\.addEventListener\('submit',saveCollection\)/,
  /#header-footer-form'\)\.addEventListener\('submit',saveHeaderFooter\)/,
  /#homepage-form'\)\.addEventListener\('submit',saveHomepage\)/,
  /#homepage-layout-save'\)\.addEventListener\('click',requestHomepageLayoutPublish\)/,
  /#homepage-publish-confirm-button'\)\?\.addEventListener\('click',saveHomepageLayout\)/,
  /#watch-layout-save'\)\.addEventListener\('click',saveWatchLayout\)/,
  /#personalized-rules-save'\)\?\.addEventListener\('click',savePersonalizedRules\)/
]) assert.match(js, binding, 'Kayıt/yayınlama kontrolü gerçek işlem fonksiyonuna bağlı olmalı');

// Duplicate diagnostics must detect repeated external identities and exact
// title/type/year matches without automatically merging or deleting records.
const integrityStart = js.indexOf('function analyzeCatalogIntegrity(catalog)');
const integrityEnd = js.indexOf('\n  const toast', integrityStart);
const integrityBody = js.slice(integrityStart, integrityEnd);
assert.ok(
  integrityStart >= 0 && integrityEnd > integrityStart &&
  integrityBody.includes('const ids=new Set(),duplicateIds=new Set(),contentGroups=new Map();') &&
  integrityBody.includes('if(key)contentGroups.set(key,(contentGroups.get(key)||0)+1);') &&
  integrityBody.includes('for(const count of contentGroups.values())if(count>1)duplicateContentCount++;') &&
  integrityBody.includes('return {validCount,duplicateCount:duplicateIds.size,duplicateContentCount,missingTitle,missingId};'),
  'Katalog denetimi mükerrer yapım gruplarını belirlemeli'
);
assert.ok(
  js.includes('const integrity=analyzeCatalogIntegrity(catalog);') &&
  js.includes('const {validCount,duplicateCount,duplicateContentCount,missingTitle,missingId}=integrity;'),
  'Sistem denetimi mükerrer yapım gruplarını saymalı'
);
assert.match(js,/system-duplicate-content-count/,
  'Mükerrer yapım sayısı admin arayüzünde gösterilmeli');
assert.match(js,/if\(duplicateContentCount>0&&note\)note\.textContent=/,
  'Mükerrer yapım bulunduğunda açıklayıcı uyarı gösterilmeli');

// Single and bulk deletion must remove every homepage slide reference, not only the legacy list.
assert.match(js,/function removeCatalogReferences\(nextData,ids\)[\s\S]*?\['heroSlides','desktopHeroSlides','mobileHeroSlides'\][\s\S]*?removeCatalogReferences\(nextData,ids\)/,
  'Toplu silme masaüstü, mobil ve eski vitrin listelerindeki referansları temizlemeli');
assert.match(js,/async function deleteContent\(id\)[\s\S]*?removeCatalogReferences\(nextData,id\)/,
  'Tekli silme tüm vitrin ve koleksiyon referanslarını temizlemeli');
// Backup imports must be bounded and validated before any destructive restore starts.
assert.match(js,/function validateBackupStorageMap\(value,label\)[\s\S]*?entries\.length>10000[\s\S]*?totalSize>8\*1024\*1024/,
  'Kişisel yedek anahtarları ve toplam veri boyutu sınırlandırılmalı');
assert.match(js,/function validateBackupPayload\(data\)[\s\S]*?catalog\.length<1\|\|catalog\.length>5000\|\|JSON\.stringify\(data\.siteData\)\.length>2000000[\s\S]*?yinelenen yapım kimliği/,
  'Site yedeği katalog boyutu, kimlik ve yapım adı bakımından önceden doğrulanmalı');
assert.match(js,/function inspectBackupFile\(file\)[\s\S]*?file\.size>10\*1024\*1024/,
  'Aşırı büyük yedek dosyaları okunmadan reddedilmeli');
assert.match(js,/async function restoreFullBackup\(\)\s*\{\s*if\(backupRestoreInProgress\)return[\s\S]*?backupRestoreInProgress=true[\s\S]*?finally\{\s*backupRestoreInProgress=false/,
  'Yedek geri yükleme aynı anda iki kez çalıştırılamamalı ve kilit serbest bırakılmalı');
assert.match(js,/restoreMainSitePersonalStorage\(previousBrowserData\)/,
  'Site kataloğu geri yüklenemezse kişisel tarayıcı verileri geri alınmalı');
const restoreStart = js.indexOf('async function restoreFullBackup()');
const restoreEnd = js.indexOf('\n  function initBackupTools', restoreStart);
const restoreBody = js.slice(restoreStart, restoreEnd);
assert.ok(
  restoreStart >= 0 && restoreEnd > restoreStart &&
  restoreBody.includes("rollbackWarning=' Ayrıca kişisel kayıtların otomatik geri alınması da başarısız oldu; ana site kayıtlarını kontrol et.';") &&
  restoreBody.includes("toast(restoreStage+' '+(error.message||'İşlem tamamlanamadı.')+rollbackWarning,'error');"),
  'Otomatik geri alma başarısızsa kullanıcıya açık uyarı gösterilmeli'
);
assert.match(js,/#catalog-select-all-page'\)\?\.addEventListener\('click'/,
  'Tümünü seç kontrolü yalnızca görünür sayfadaki kayıtları seçmeli');

console.log('PASS: Ortak katalog kayıt akışı ve çakışma yönetimi');
console.log('PASS: Yapım, koleksiyon, film serisi ve düzenleme kayıt doğrulamaları');
console.log('PASS: Silme işlemlerinde kullanıcı onayı ve kalıcı kayıt');
console.log('PASS: Yayınlama ve kayıt kontrollerinin olay bağlantıları');
