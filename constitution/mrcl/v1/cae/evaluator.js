'use strict';

/**
 * @param {Record<string, any>} obj
 * @param {string} pathStr
 * @returns {any}
 */
function getValue(obj, pathStr) {
  if (!pathStr) return undefined;
  const parts = String(pathStr).split('.');
  let cursor = obj;
  for (const key of parts) {
    if (cursor == null) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

/**
 * @param {{op?: string, path?: string, value?: any, value_path?: string, predicate?: any, predicates?: any[]}} node
 * @param {Record<string, any>} context
 * @returns {boolean}
 */
function evaluatePredicate(node, context) {
  if (!node || typeof node !== 'object') return false;

  const op = node.op;
  if (op === 'exists') {
    return getValue(context, node.path) !== undefined;
  }

  if (op === 'not') {
    return !evaluatePredicate(node.predicate, context);
  }

  if (op === 'all') {
    if (!Array.isArray(node.predicates)) return false;
    return node.predicates.every((p) => evaluatePredicate(p, context));
  }

  if (op === 'any') {
    if (!Array.isArray(node.predicates)) return false;
    return node.predicates.some((p) => evaluatePredicate(p, context));
  }

  const left = getValue(context, node.path);
  const right = node.value_path ? getValue(context, node.value_path) : node.value;

  switch (op) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'gt':
      return Number(left) > Number(right);
    case 'gte':
      return Number(left) >= Number(right);
    case 'lt':
      return Number(left) < Number(right);
    case 'lte':
      return Number(left) <= Number(right);
    case 'in':
      return Array.isArray(right) && right.includes(left);
    case 'contains':
      if (typeof left === 'string') {
        return String(left).toLowerCase().includes(String(right).toLowerCase());
      }
      if (Array.isArray(left)) {
        return left.includes(right);
      }
      return false;
    default:
      return false;
  }
}

/**
 * @param {Record<string, any>} article
 * @param {Record<string, any>} event
 */
function evaluateArticle(article, event) {
  const predicateKind = article.predicate_kind || 'violation_if_true';
  const predicateMatched = evaluatePredicate(article.predicate, event);

  const violation = predicateKind === 'compliant_if_true'
    ? !predicateMatched
    : predicateMatched;

  let result = 'PASS';
  if (violation) {
    result = article?.enforcement?.mode === 'log' ? 'WARN' : 'FAIL';
  }

  return {
    result,
    evidence: {
      predicate_kind: predicateKind,
      predicate_op: article?.predicate?.op || null,
      predicate_matched: predicateMatched,
      violation,
      enforcement_mode: article?.enforcement?.mode || 'log'
    }
  };
}

module.exports = {
  getValue,
  evaluatePredicate,
  evaluateArticle
};
