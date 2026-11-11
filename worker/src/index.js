const API_VERSION = "2022-11-28";
let cachedJwks = null;
let cachedJwksAt = 0;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function getAccessKeys(teamDomain) {
  const now = Date.now();
  if (cachedJwks && now - cachedJwksAt < 10 * 60 * 1000) return cachedJwks;
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
    headers: { accept: "application/json" },
    cf: { cacheTtl: 600, cacheEverything: true }
  });
  if (!response.ok) throw new Error("Cloudflare Access anahtarları alınamadı.");
  cachedJwks = await response.json();
  cachedJwksAt = now;
  return cachedJwks;
}

async function authorize(request, env) {
  const teamDomain = String(env.CF_ACCESS_TEAM_DOMAIN || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const audience = String(env.CF_ACCESS_AUD || "").trim();
  if (!teamDomain || !audience) return { ok: false, status: 503, error: "Cloudflare Access yapılandırması tamamlanmamış." };

  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return { ok: false, status: 401, error: "Yönetici oturumu gerekli." };

  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("JWT biçimi geçersiz.");
    const header = decodeJwtPart(parts[0]);
    const claims = decodeJwtPart(parts[1]);
    if (header.alg !== "RS256" || !header.kid) throw new Error("JWT algoritması geçersiz.");
    const issuer = `https://${teamDomain}`;
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(audience)) throw new Error("JWT hedefi doğrulanamadı.");
    if (typeof claims.exp !== "number" || claims.exp <= now || (typeof claims.nbf === "number" && claims.nbf > now + 60)) throw new Error("JWT süresi geçersiz.");

    const jwks = await getAccessKeys(teamDomain);
    const jwk = (jwks.keys || []).find(key => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) {
      cachedJwks = null;
      const refreshed = await getAccessKeys(teamDomain);
      const retryKey = (refreshed.keys || []).find(key => key.kid === header.kid && key.kty === "RSA");
      if (!retryKey) throw new Error("JWT imza anahtarı bulunamadı.");
      const cryptoKey = await crypto.subtle.importKey("jwk", retryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
      const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, decodeBase64Url(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
      if (!valid) throw new Error("JWT imzası geçersiz.");
    } else {
      const cryptoKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
      const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, decodeBase64Url(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
      if (!valid) throw new Error("JWT imzası geçersiz.");
    }
    return { ok: true, claims };
  } catch (error) {
    return { ok: false, status: 401, error: "Yönetici oturumu doğrulanamadı." };
  }
}

function githubHeaders(env) {
  return {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": API_VERSION,
    "user-agent": "CineVerse-Admin-Worker"
  };
}

function catalogUrl(env) {
  const owner = encodeURIComponent(env.GITHUB_OWNER || "megamrtklc");
  const repo = encodeURIComponent(env.GITHUB_REPO || "mrtklc");
  const path = String(env.GITHUB_CATALOG_PATH || "filmvediziler.json").split("/").map(encodeURIComponent).join("/");
  const branch = encodeURIComponent(env.GITHUB_BRANCH || "main");
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
}

async function readCatalog(env) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN secret tanımlanmamış.");
  const response = await fetch(catalogUrl(env), { headers: githubHeaders(env) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "GitHub kataloğu okunamadı.");
  if (!payload.content || !payload.sha) throw new Error("GitHub katalog içeriği veya SHA bilgisi eksik.");
  const binary = atob(payload.content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || !Array.isArray(data.catalog)) throw new Error("Katalog JSON yapısı beklenen biçimde değil.");
  return { data, sha: payload.sha };
}

async function writeCatalog(env, data, expectedSha) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN secret tanımlanmamış.");
  if (!data || typeof data !== "object" || !Array.isArray(data.catalog)) throw new Error("Gönderilen katalog yapısı geçersiz.");
  if (data.catalog.length < 1 || data.catalog.length > 5000) throw new Error("Katalog kayıt sayısı sınır dışında.");
  if (JSON.stringify(data).length > 2_000_000) throw new Error("Katalog boyutu 2 MB sınırını aşıyor.");
  const ids = new Set();
  for (const item of data.catalog) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Katalogda geçersiz kayıt bulundu.");
    if (item.id !== undefined && item.id !== null) {
      const id = String(item.id);
      if (ids.has(id)) throw new Error("Katalogda yinelenen kayıt kimliği var: " + id);
      ids.add(id);
    }
  }

  const current = await fetch(catalogUrl(env), { headers: githubHeaders(env) });
  const currentPayload = await current.json();
  if (!current.ok) throw new Error(currentPayload.message || "Güncel katalog SHA bilgisi alınamadı.");
  if (currentPayload.sha !== expectedSha) return { conflict: true, sha: currentPayload.sha };

  const encoded = bytesToBase64(new TextEncoder().encode(JSON.stringify(data, null, 2)));
  const response = await fetch(catalogUrl(env).split("?")[0], {
    method: "PUT",
    headers: { ...githubHeaders(env), "content-type": "application/json" },
    body: JSON.stringify({
      message: "Update CineVerse catalog from admin",
      content: encoded,
      sha: expectedSha,
      branch: env.GITHUB_BRANCH || "main"
    })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Katalog GitHub'a kaydedilemedi.");
  return { conflict: false, sha: result.content?.sha || null, commit: result.commit?.sha || null };
}

export default {
  async fetch(request, env) {
    const auth = await authorize(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (request.method === "GET" && url.pathname === "/api/session") {
      return json({ authenticated: true, email: auth.claims.email || null });
    }

    if (request.method === "GET" && url.pathname === "/api/catalog") {
      try {
        const result = await readCatalog(env);
        return json(result);
      } catch (error) {
        return json({ error: error.message || "Katalog okunamadı." }, 502);
      }
    }

    if (request.method === "PUT" && url.pathname === "/api/catalog") {
      try {
        const length = Number(request.headers.get("content-length") || 0);
        if (length > 2_500_000) return json({ error: "İstek boyutu sınırı aşıldı." }, 413);
        const body = await request.json();
        if (!body || typeof body.sha !== "string" || !body.sha) return json({ error: "Güncel katalog SHA bilgisi gerekli." }, 400);
        const result = await writeCatalog(env, body.data, body.sha);
        if (result.conflict) return json({ error: "Katalog başka bir işlemde güncellenmiş. Veriyi yeniden yükleyip tekrar deneyin.", sha: result.sha }, 409);
        return json({ ok: true, sha: result.sha, commit: result.commit });
      } catch (error) {
        return json({ error: error.message || "Katalog kaydedilemedi." }, 400);
      }
    }

    return json({ error: "API endpoint bulunamadı." }, 404);
  }
};
