import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root || !fs.existsSync(root)) {
  throw new Error('Lighthouse çıktı klasörü bulunamadı: ' + root);
}

function collectJsonFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? collectJsonFiles(fullPath)
      : entry.isFile() && entry.name.endsWith('.json') ? [fullPath] : [];
  });
}

const reports = collectJsonFiles(root)
  .map(file => {
    try {
      return { file, report: JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch {
      return null;
    }
  })
  .filter(item => item?.report?.categories && item?.report?.audits);

if (!reports.length) {
  throw new Error('Lighthouse JSON raporu bulunamadı: ' + root);
}

for (const { file, report } of reports) {
  const categories = report.categories;
  const scores = Object.fromEntries(
    ['performance', 'accessibility', 'best-practices', 'seo']
      .map(key => [key, categories[key]?.score == null ? null : Math.round(categories[key].score * 100)])
  );
  const audits = report.audits || {};
  const metrics = Object.fromEntries(
    ['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift']
      .map(key => [key, audits[key]?.displayValue || 'N/A'])
  );
  const findings = Object.values(audits)
    .filter(audit => audit.score != null && audit.score < 1)
    .sort((a, b) => (b.details?.overallSavingsMs || 0) - (a.details?.overallSavingsMs || 0))
    .slice(0, 12)
    .map(audit => ({
      id: audit.id,
      title: audit.title,
      score: audit.score,
      displayValue: audit.displayValue || null,
      savingsMs: audit.details?.overallSavingsMs || 0,
      savingsBytes: audit.details?.overallSavingsBytes || 0,
      affected: (audit.details?.items || []).slice(0, 5).map(item => ({
        url: item.url || null,
        selector: item.node?.selector || null,
        snippet: item.node?.snippet || null,
        description: item.description || null,
        source: item.source || null,
        contrastRatio: item.contrastRatio || null,
        wastedBytes: item.wastedBytes || 0
      }))
    }));
  const lcpAuditIds = [
    'largest-contentful-paint-element',
    'lcp-discovery-insight',
    'lcp-breakdown-insight',
    'lcp-request-discovery'
  ];
  const lcpDiagnostics = {
    audits: Object.values(audits)
      .filter(audit => /lcp|largest-contentful-paint/i.test(audit.id || ''))
      .map(audit => ({
        id: audit.id,
        title: audit.title || null,
        score: audit.score ?? null,
        displayValue: audit.displayValue || null,
        numericValue: audit.numericValue ?? null,
        detailsType: audit.details?.type || null,
        detailsKeys: Object.keys(audit.details || {}),
        itemsCount: audit.details?.items?.length ?? null
      })),
    slowRequests: (audits['network-requests']?.details?.items || [])
      .slice()
      .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
      .slice(0, 12)
      .map(item => ({
        url: item.url || null,
        resourceType: item.resourceType || null,
        startTime: item.startTime ?? null,
        endTime: item.endTime ?? null,
        duration: item.duration ?? null,
        transferSize: item.transferSize ?? null,
        priority: item.priority || null,
        statusCode: item.statusCode ?? null
      }))
  };
  const networkItems = audits['network-requests']?.details?.items || [];
  const diagnostics = {
    mainThread: (audits['mainthread-work-breakdown']?.details?.items || []).slice(0, 10).map(item => ({
      group: item.group || null,
      duration: item.duration ?? null,
      scripting: item.scripting ?? null,
      scriptEvaluation: item.scriptEvaluation ?? null,
      scriptParseCompile: item.scriptParseCompile ?? null,
      styleLayout: item.styleLayout ?? null,
      other: item.other ?? null,
      url: item.url || null,
      entity: item.entity?.name || item.entity || null
    })),
    lcpElement: (audits['largest-contentful-paint-element']?.details?.items || []).slice(0, 3).map(item => ({
      selector: item.node?.selector || null,
      snippet: item.node?.snippet || null,
      url: item.url || null,
      size: item.size ?? null,
      timing: item.timing || null
    })),
    failedRequests: networkItems.filter(item => item.statusCode >= 400).map(item => ({
      url: item.url || null,
      statusCode: item.statusCode,
      resourceType: item.resourceType || null
    }))
  };
  console.log(JSON.stringify({
    report: file,
    url: report.requestedUrl || report.finalDisplayedUrl,
    scores,
    metrics,
    findings,
    lcpDiagnostics,
    diagnostics
  }));
}
