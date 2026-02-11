#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CAE = require('./cae/engine');
const stateManager = require('./cae/state_manager');

function detectTypeIII(rawText) {
  return /\b(Tipo\s*III|Type\s*III)\b/i.test(rawText);
}

function detectAgentLevel(rawText) {
  const explicit = rawText.match(/\b(?:agent[_ -]?level|nivel)\s*[:=]\s*(A[0-3])\b/i);
  if (explicit) return explicit[1].toUpperCase();
  if (/\bA3\b/i.test(rawText)) return 'A3';
  if (/\bA2\b/i.test(rawText)) return 'A2';
  if (/\bA1\b/i.test(rawText)) return 'A1';
  return 'A0';
}

function extractNumber(rawText, regex) {
  const match = rawText.match(regex);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function extractCurrentScore(rawText) {
  return extractNumber(rawText, /\b(?:alignment_score|current_score)\s*[:=]\s*([0-9]*\.?[0-9]+)\b/i);
}

function detectAgentId(rawText) {
  const match = rawText.match(/\b(?:agent_id|author_id)\s*[:=]\s*([a-zA-Z0-9:_-]+)\b/i);
  return match ? match[1] : 'agent:unknown';
}

function buildCanonicalEvent(rawText, inputPath) {
  const isTypeIII = detectTypeIII(rawText);
  const agentLevel = detectAgentLevel(rawText);
  const currentScore = extractCurrentScore(rawText);
  const rmz = extractNumber(rawText, /\b(?:quorum[_ ]?rmz|rmz_quorum)\s*[:=]\s*([0-9]*\.?[0-9]+)\b/i);
  const tonalli = extractNumber(rawText, /\b(?:quorum[_ ]?tonalli|tonalli_quorum)\s*[:=]\s*([0-9]*\.?[0-9]+)\b/i);
  const timelock = extractNumber(rawText, /\b(?:timelock|timelock_seconds)\s*[:=]\s*([0-9]+)\b/i);
  const spendCurrent = extractNumber(rawText, /\b(?:current_period_total|spent_current)\s*[:=]\s*([0-9]*\.?[0-9]+)\b/i);
  const spendLimit = extractNumber(rawText, /\b(?:period_limit|spend_limit)\s*[:=]\s*([0-9]*\.?[0-9]+)\b/i);
  const txAmount = extractNumber(rawText, /\b(?:tx[_ ]?amount|tx\.amount)\s*[:=]\s*([0-9]*\.?[0-9]+)\b/i);

  return {
    event_id: `evt-${crypto.randomBytes(8).toString('hex')}`,
    event_type: 'rfc.submitted',
    timestamp: new Date().toISOString(),
    actor: {
      agent_id: detectAgentId(rawText),
      agent_level: agentLevel,
      current_score: currentScore == null ? 1 : currentScore
    },
    context: {
      rfc: {
        source_path: inputPath,
        raw_text: rawText,
        change_type: isTypeIII ? 'III' : 'UNKNOWN'
      },
      proposal: {
        summary: rawText.slice(0, 4000)
      },
      agent: {
        level: agentLevel,
        delegates_purpose: /\bdelegaci[oó]n completa\b/i.test(rawText),
        autonomy_score: extractNumber(rawText, /\bautonomy_score\s*[:=]\s*([0-9]*\.?[0-9]+)\b/i) || 0
      },
      governance: {
        timelock_seconds: timelock == null ? 0 : timelock,
        quorum: {
          RMZ: rmz == null ? 0 : rmz,
          Tonalli: tonalli == null ? 0 : tonalli
        },
        stake: {
          Obsidiana: /\bobsidiana\b/i.test(rawText)
        }
      },
      spending: {
        current_period_total: spendCurrent == null ? 0 : spendCurrent,
        period_limit: spendLimit == null ? 0 : spendLimit,
        circuit_breaker_hits: /circuit breaker/i.test(rawText) ? 1 : 0
      },
      transaction: {
        allowlisted: !/allowlist\s*:\s*false/i.test(rawText)
      },
      tx: {
        amount: txAmount == null ? null : txAmount
      }
    },
    proofs: {
      source: inputPath
    }
  };
}

function isA2A3(level) {
  const normalized = String(level || '').toUpperCase();
  return normalized === 'A2' || normalized === 'A3';
}

function buildCapabilityGatingDecision(event, agentState) {
  const decisionId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  const restrictions = agentState?.restrictions && typeof agentState.restrictions === 'object'
    ? agentState.restrictions
    : { active: [] };
  const capabilities = agentState?.capabilities && typeof agentState.capabilities === 'object'
    ? agentState.capabilities
    : {};
  const band = agentState?.band || 'nominal';

  return {
    decision_id: decisionId,
    event_id: event.event_id,
    verdict: 'ENFORCE',
    applied_articles: ['CAPABILITY_GATING/RFC_PROPOSE'],
    results: [
      {
        article_id: 'CAPABILITY_GATING/RFC_PROPOSE',
        result: 'FAIL',
        precedence: 100,
        weight: 1,
        severity_band: 'core_hlp',
        evidence: {
          reason: 'capabilities.can_propose_rfc=false',
          event_type: event.event_type
        }
      }
    ],
    enforcement: {
      mode: 'quarantine',
      severity: 'high',
      actions: ['block_rfc_submission']
    },
    alignment: {
      before: Number(agentState?.alignment_score ?? 1),
      delta: 0,
      after: Number(agentState?.alignment_score ?? 1)
    },
    audit_hash: null,
    state: {
      restrictions,
      consecutive_fails: Number(agentState?.consecutive_fails ?? 0),
      spend_daily: agentState?.counters?.spend_daily || null,
      prev_audit_hash: agentState?.audit?.prev_audit_hash || null,
      last_audit_hash: agentState?.audit?.last_audit_hash || null
    },
    agent_state: {
      band,
      capabilities,
      restrictions,
      consecutive_fails: Number(agentState?.consecutive_fails ?? 0)
    }
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node policy-enforcer.js <rfc-markdown-path>');
    process.exit(1);
  }

  const rawText = fs.readFileSync(path.resolve(process.cwd(), inputPath), 'utf8');
  const event = buildCanonicalEvent(rawText, inputPath);
  const actorLevel = String(event?.actor?.agent_level || 'A0').toUpperCase();
  const currentAgentState = stateManager.getAgent(event?.actor?.agent_id || 'agent:unknown');
  const currentCapabilities = currentAgentState?.capabilities && typeof currentAgentState.capabilities === 'object'
    ? currentAgentState.capabilities
    : {};
  const shouldGateProposal = (
    event.event_type === 'rfc.submitted' &&
    isA2A3(actorLevel) &&
    currentCapabilities.can_propose_rfc === false
  );

  const result = shouldGateProposal
    ? { decision: buildCapabilityGatingDecision(event, currentAgentState), audit_file: null }
    : CAE.evaluate(event);
  const decision = result.decision;
  const auditFile = result.audit_file;

  const overall = decision.verdict === 'PASS' ? 'PASS' : 'FAIL';
  const evidenceRows = decision.results.filter((r) => r.result !== 'PASS').slice(0, 8);

  console.log('HLP-COMPLIANCE-BOT');
  console.log(`RFC: ${inputPath}`);
  console.log(`DECISION_ID: ${decision.decision_id}`);
  console.log(`EVENT_ID: ${decision.event_id}`);
  console.log(`OVERALL: ${overall}`);
  console.log(`ENFORCEMENT: mode=${decision.enforcement.mode} severity=${decision.enforcement.severity} actions=${decision.enforcement.actions.join(',')}`);
  console.log(`ALIGNMENT: before=${decision.alignment.before.toFixed(4)} delta=${decision.alignment.delta.toFixed(4)} after=${decision.alignment.after.toFixed(4)}`);
  const agentState = decision?.agent_state || {};
  const capabilities = agentState?.capabilities || {};
  const band = agentState?.band || 'unknown';
  const proposeCap = capabilities?.can_propose_rfc;
  const voteCap = capabilities?.can_vote_typeII_III;
  const signMode = capabilities?.sign_mode;
  const rmzBondMultiplier = capabilities?.rmz_proposal_bond_multiplier;
  console.log(`BAND: ${band}`);
  console.log(`CAPABILITIES: propose=${proposeCap === undefined ? 'n/a' : String(proposeCap)} vote_typeII_III=${voteCap === undefined ? 'n/a' : String(voteCap)} sign=${signMode || 'n/a'}`);
  console.log(`RMZ_BOND_MULTIPLIER: ${rmzBondMultiplier === undefined ? 'n/a' : String(rmzBondMultiplier)}`);
  const activeRestrictions = Array.isArray(decision?.state?.restrictions?.active)
    ? decision.state.restrictions.active
    : [];
  console.log(`STATE: restrictions=${activeRestrictions.length ? activeRestrictions.join(',') : 'none'} consecutive_fails=${decision?.state?.consecutive_fails ?? 0}`);
  if (decision?.state?.prev_audit_hash || decision?.state?.last_audit_hash) {
    console.log(`AUDIT_CHAIN: prev=${decision.state.prev_audit_hash || 'null'} current=${decision.state.last_audit_hash || 'null'}`);
  }
  console.log(`AUDIT: hash=${decision.audit_hash} file=${auditFile}`);
  console.log('EVIDENCE:');
  if (evidenceRows.length === 0) {
    console.log('- none');
  } else {
    for (const r of evidenceRows) {
      console.log(`- ${r.article_id} [${r.result}] precedence=${r.precedence} band=${r.severity_band}`);
    }
  }
}

main();
