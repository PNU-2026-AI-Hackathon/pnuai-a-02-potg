import dns from 'dns/promises';
import net from 'net';
import { AttachmentProcessingError } from './attachmentErrors';

export type AddressResolver = (hostname: string) => Promise<readonly { address: string }[]>;

function stripIpv6Brackets(address: string) {
  return address.startsWith('[') && address.endsWith(']') ? address.slice(1, -1) : address;
}

function isBlockedIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function isBlockedIpv6(address: string) {
  const normalized = stripIpv6Brackets(address).toLowerCase().split('%')[0];
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return net.isIP(mapped) === 4 ? isBlockedIpv4(mapped) : true;
  }
  const first = Number.parseInt(normalized.split(':')[0] || '0', 16);
  return (first & 0xfe00) === 0xfc00
    || (first & 0xffc0) === 0xfe80
    || (first & 0xff00) === 0xff00
    || normalized.startsWith('2001:db8:');
}

export function isPrivateOrReservedAddress(address: string) {
  const normalized = stripIpv6Brackets(address);
  const version = net.isIP(normalized);
  return version === 4 ? isBlockedIpv4(normalized) : version === 6 ? isBlockedIpv6(normalized) : true;
}

const defaultResolver: AddressResolver = async (hostname) => dns.lookup(hostname, { all: true, verbatim: true });

export async function validateAttachmentUrl(
  value: string,
  allowedHosts: readonly string[],
  resolver: AddressResolver = defaultResolver,
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AttachmentProcessingError('INVALID_URL', 'Attachment URL is invalid.');
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new AttachmentProcessingError('INVALID_URL', 'Attachment URL must use HTTPS without credentials or a custom port.');
  }

  const hostname = stripIpv6Brackets(url.hostname).toLowerCase();
  if (!allowedHosts.some((allowed) => hostname === allowed.toLowerCase())) {
    throw new AttachmentProcessingError('HOST_NOT_ALLOWED', 'Attachment host is not allowed.');
  }

  const literalVersion = net.isIP(hostname);
  const addresses = literalVersion ? [{ address: hostname }] : await resolver(hostname).catch(() => {
    throw new AttachmentProcessingError('DOWNLOAD_FAILED', 'Attachment host could not be resolved.', true);
  });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateOrReservedAddress(address))) {
    throw new AttachmentProcessingError('PRIVATE_ADDRESS_BLOCKED', 'Attachment host resolves to a private or reserved address.');
  }

  return url;
}
