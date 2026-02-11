'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function stableSerialize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map((v) => stableSerialize(v)).join(',') + ']';
  }

  const keys = Object.keys(value).sort();
  const body = keys
    .map((k) => JSON.stringify(k) + ':' + stableSerialize(value[k]))
    .join(',');
  return '{' + body + '}';
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * @param {{auditDir: string, event: Record<string, any>, decision: Record<string, any>}} args
 */
function writeAuditBundle(args) {
  const payload = {
    generated_at: new Date().toISOString(),
    event_snapshot: args.event,
    decision: {
      decision_id: args.decision.decision_id,
      event_id: args.decision.event_id,
      verdict: args.decision.verdict,
      applied_articles: args.decision.applied_articles,
      results: args.decision.results,
      enforcement: args.decision.enforcement,
      alignment: args.decision.alignment
    }
  };

  const prehash = stableSerialize(payload);
  const hash = sha256Hex(prehash);
  const finalBundle = {
    ...payload,
    audit_hash: hash
  };

  fs.mkdirSync(args.auditDir, { recursive: true });
  const shortHash = hash.slice(0, 12);
  const filename = `${args.decision.decision_id}--${shortHash}.json`;
  const target = path.join(args.auditDir, filename);

  fs.writeFileSync(target, JSON.stringify(finalBundle, null, 2), 'utf8');

  return {
    audit_hash: hash,
    audit_file: target,
    bundle: finalBundle
  };
}

module.exports = {
  stableSerialize,
  sha256Hex,
  writeAuditBundle
};
