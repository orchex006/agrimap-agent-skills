// Local, deterministic redaction. No network, raw-value sidecar, or recovery map.
import { writeFile as fsWriteFile, appendFile as fsAppendFile } from 'node:fs/promises';

const marker = type => `[REDACTED:${type}]`;
const sensitiveKey = /(?:password|passwd|pwd|passphrase|secret|clientsecret|apisecret|apikey|accesskey|secretaccesskey|awssecretaccesskey|token|accesstoken|refreshtoken|idtoken|authtoken|authorization|cookie|setcookie|connectionstring|privatekey|รหัสผ่าน)$/i;
const personalKey = /^(?:email|phone|phonenumber|mobile|telephone|nationalid|citizenid|ssn|creditcard|cardnumber|cvv|อีเมล|เบอร์โทร|เลขบัตรประชาชน)$/i;
const normalizeKey = key => key.replace(/[\s_-]/g, '');
const alreadyMasked = value => /^\[REDACTED:[A-Z_]+\]$/.test(String(value));
const labels = 'password|passwd|pwd|passphrase|secret|client[_ -]?secret|api[_ -]?(?:key|secret)|(?:access|refresh|id|auth)[_ -]?token|token|(?:aws[_ -]?)?(?:secret[_ -]?)?access[_ -]?key|authorization|cookie|set[_ -]?cookie|connection[_ -]?string|private[_ -]?key|email|phone(?:[_ -]?number)?|mobile|telephone|national[_ -]?id|citizen[_ -]?id|ssn|credit[_ -]?card|card[_ -]?number|cvv|รหัสผ่าน|อีเมล|เบอร์โทร|เลขบัตรประชาชน';
const assignments = new RegExp(`(?<![\\p{L}\\p{N}_])(["']?)((?:[\\p{L}][\\p{L}\\p{N}_-]*[_-])?(?:${labels}))\\1(\\s*[:=]\\s*)("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\\[REDACTED:[A-Z_]+\\]|[^\\r\\n;,&#}]+)`, 'giu');

export function redactText(value) {
  let text = String(value);
  // Preserve block boundaries, including an incomplete pasted private key.
  text = text.replace(/-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----[\s\S]*?(?:-----END \1-----|$)/g, marker('PRIVATE_KEY'));
  text = text.replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b/g, marker('TOKEN'));
  text = text.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, marker('TOKEN'));
  text = text.replace(/\b(Bearer|Basic)\s+(?!\[REDACTED:)[A-Za-z0-9+/_=.-]+/gi, (_, scheme) => `${scheme} ${marker('AUTH')}`);
  text = text.replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, (_, scheme) => `${scheme}${marker('CREDENTIAL')}@`);
  // Header values can contain spaces and multiple cookie values.
  text = text.replace(/^(\s*(?:Authorization|Proxy-Authorization|Cookie|Set-Cookie)\s*:\s*)[^\r\n]+/gmi, (_, prefix) => prefix + marker('AUTH'));
  // Quoted values keep quoting intact. Unquoted assignments end at a common
  // connection-string/query delimiter or line end (including spaced passwords).
  text = text.replace(assignments,
    (whole, quote, key, separator, raw) => {
      const candidates = [key];
      const type = candidates.some(k => sensitiveKey.test(normalizeKey(k))) ? 'CREDENTIAL'
        : candidates.some(k => personalKey.test(normalizeKey(k))) ? 'PERSONAL' : null;
      if (!type) return whole;
      const quoted = raw[0] === '"' || raw[0] === "'";
      const content = quoted ? raw.slice(1, -1) : raw;
      if (alreadyMasked(content)) return whole;
      return quote + key + quote + separator + (quoted ? raw[0] + marker(type) + raw[0] : marker(type));
    });
  text = text.replace(/\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}\b/gi, marker('EMAIL'));
  return text;
}

export function redactValue(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const type = sensitiveKey.test(normalizeKey(key)) ? 'CREDENTIAL' : personalKey.test(normalizeKey(key)) ? 'PERSONAL' : null;
    return [key, type && item !== null && item !== '' ? (alreadyMasked(item) ? item : marker(type)) : redactValue(item)];
  }));
}

function safeRecord(file, data) {
  // Do not transform installed bootstrap templates or product/source files.
  if (!String(file).replaceAll('\\', '/').toLowerCase().split('/').includes('.agrimap-agent')) return data;
  const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
  if (/\.jsonl?$/i.test(String(file))) {
    // Sanitize values before serialization so redaction cannot break JSON syntax.
    try { return JSON.stringify(redactValue(JSON.parse(text)), null, /\.json$/i.test(String(file)) ? 2 : undefined) + '\n'; }
    catch { /* Legacy/text records are still redacted; never fall back to raw. */ }
  }
  return redactText(text);
}

export const writeRecord = (file, data, options) => fsWriteFile(file, safeRecord(file, data), options);
export const appendRecord = (file, data, options) => fsAppendFile(file, safeRecord(file, data), options);

// Detection for delivery gates: same patterns as redactText, reporting only the
// marker kind and 1-based line number. Callers must never echo detected values.
export function detectSensitive(value) {
  const findings = [];
  const lines = String(value ?? '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const redacted = redactText(lines[index]);
    if (redacted === lines[index]) continue;
    const kinds = new Set([...redacted.matchAll(/\[REDACTED:([A-Z_]+)\]/g)].map(match => match[1]));
    for (const kind of kinds) if (!lines[index].includes(marker(kind))) findings.push({ kind, line: index + 1 });
  }
  return findings;
}
