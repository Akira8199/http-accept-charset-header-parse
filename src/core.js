/**
 * http-accept-charset-header-parse
 *
 * Parses RFC 7231 §5.3.3 Accept-Charset into a list of character sets
 * with quality factors, and provides a small helper for picking the
 * best server-offered charset.
 *
 * Design decisions:
 *  - Charset tokens are case-normalised to UPPERCASE because charset
 *    names are case-insensitive per the IANA registry. Keeping a single
 *    canonical case lets callers compare with ===.
 *  - An absent q parameter defaults to 1, exactly as the RFC requires.
 *  - A q of 0 means "not acceptable" and is preserved in the parsed
 *    output so callers can see it, but pickCharset() will never select it.
 *  - If the header is absent or produces no acceptable charset, pickCharset()
 *    returns null rather than throwing. Servers then decide their own fallback.
 *  - The "*" wildcard is treated like any other token: it is returned with
 *    its declared q, and pickCharset() honours it as a catch-all match.
 *  - We do NOT insert an implicit ISO-8859-1 with q=1 when the header is
 *    absent. That rule is about header absence, not header content, and
 *    conflating the two causes bugs. Callers who want that behaviour should
 *    pass null and handle it themselves.
 */

/**
 * @typedef {Object} CharsetSpec
 * @property {string} charset  Character set name, upper-cased. May be "*".
 * @property {number} q        Quality factor in [0,1].
 */

/**
 * Clamp a parsed q value into [0,1].
 * The RFC allows up to three digits; we accept any finite number and clamp
 * so a malformed "q=1.5" becomes 1 rather than crashing downstream math.
 *
 * @param {number} v
 * @returns {number}
 */
function clampQ(v) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Parse the numeric portion of a "q=..." parameter.
 * Returns NaN on anything that is not a clean decimal so the caller can
 * fall back to the default of 1.
 *
 * @param {string} raw
 * @returns {number}
 */
function parseQValue(raw) {
  if (raw === '') return Number.NaN;
  const n = Number(raw);
  return n;
}

/**
 * Parse an Accept-Charset header value into an ordered list of CharsetSpec.
 *
 * Returns [] for null/undefined/empty input. The order of the output matches
 * the order tokens appear in the header, so callers that want to respect
 * client preference can simply iterate.
 *
 * @param {string|null|undefined} header
 * @returns {CharsetSpec[]}
 */
export function parseAcceptCharset(header) {
  if (header == null || header.trim() === '') return [];

  const out = [];
  // Commas separate charset ranges. We split on commas first, then handle
  // parameters within each range. This is simpler and good enough because
  // charset names and q-values never contain commas.
  const parts = header.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed === '') continue;

    // Parameters are separated by ';'. The first segment is the charset name.
    const segments = trimmed.split(';');
    const name = segments[0].trim();
    if (name === '') continue;

    let q = 1; // default per RFC 7231

    for (let i = 1; i < segments.length; i++) {
      const param = segments[i].trim();
      if (param === '') continue;
      const eq = param.indexOf('=');
      if (eq === -1) continue;
      const pname = param.slice(0, eq).trim().toLowerCase();
      const pval = param.slice(eq + 1).trim();
      if (pname === 'q') {
        const parsed = parseQValue(pval);
        if (!Number.isNaN(parsed)) {
          q = clampQ(parsed);
        }
        // If q is unparseable we deliberately keep the default of 1 rather
        // than zeroing the entry: a broken q= should not silently turn an
        // explicit charset into "not acceptable".
      }
    }

    out.push({ charset: name.toUpperCase(), q });
  }

  return out;
}

/**
 * Choose the best charset to serve from a list the server offers.
 *
 * Wildcard "*" in the parsed header matches any offered charset. Among
 * equally-preferred offers, the first one in the server's list wins —
 * this gives the server a deterministic tie-break it controls.
 *
 * Returns null when nothing acceptable is available.
 *
 * @param {CharsetSpec[]} accepted  Output of parseAcceptCharset.
 * @param {string[]} offered        Charsets the server can produce, in preference order.
 * @returns {string|null}
 */
export function pickCharset(accepted, offered) {
  if (!Array.isArray(accepted) || !Array.isArray(offered)) return null;
  if (offered.length === 0) return null;

  const upperOffered = offered.map((c) => c.toUpperCase());

  let best = null;
  let bestQ = 0; // strictly positive to win; q=0 entries are excluded

  for (let i = 0; i < upperOffered.length; i++) {
    const candidate = upperOffered[i];
    let q = 0;
    let matched = false;

    for (const spec of accepted) {
      if (spec.q <= 0) continue;
      if (spec.charset === candidate || spec.charset === '*') {
        matched = true;
        if (spec.q > q) q = spec.q;
      }
    }

    if (!matched) continue;
    if (q > bestQ || best === null) {
      best = candidate;
      bestQ = q;
    }
  }

  return best;
}

/**
 * Serialise a list of CharsetSpec back into a valid header string.
 *
 * q=1 entries omit the q parameter to match common header style and keep
 * the output shorter. Entries with q=0 are emitted as "charset;q=0".
 *
 * @param {CharsetSpec[]} specs
 * @returns {string}
 */
export function formatAcceptCharset(specs) {
  if (!Array.isArray(specs)) return '';
  const pieces = [];
  for (const s of specs) {
    if (s.q >= 1) {
      pieces.push(s.charset);
    } else {
      // Round to 3 decimals — the RFC's precision — and strip trailing zeros
      // so q=0.5 stays "0.5" rather than "0.500".
      const fixed = s.q.toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0');
      pieces.push(`${s.charset};q=${fixed}`);
    }
  }
  return pieces.join(', ');
}
