import { isIP } from 'node:net';

/**
 * The key the recovery route's per-client limit counts on (BL-026, Cycle Audit 3 FND-0083). An IPv4 address is its
 * own key (an IPv4-mapped IPv6 address included); an IPv6 address counts by its /64, because one subscriber usually
 * controls a whole /64 and could otherwise present a new "client" with every request.
 */
export function clientBucket(address: string): string {
  const a = address.trim().toLowerCase().split('%')[0];
  const mapped = a.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  if (isIP(a) !== 6) return a;
  return `${expandIpv6(a).slice(0, 4).join(':')}::/64`;
}

/** The eight 4-digit groups of an IPv6 address (`::` expanded, a trailing dotted IPv4 part converted). */
function expandIpv6(address: string): string[] {
  let s = address;
  const v4 = s.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const [a, b, c, d] = v4[1].split('.').map(Number);
    s = `${s.slice(0, -v4[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = s.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length > 1 ? Array<string>(8 - left.length - right.length).fill('0') : [];
  return [...left, ...fill, ...right].map((group) => group.padStart(4, '0'));
}
