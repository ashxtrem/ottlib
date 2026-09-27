import { hostname } from 'node:os';
import Bonjour from 'bonjour-service';
import { apiVersion } from '@ottlib/shared';
import { discoveryServiceType } from '../config/defaults.js';

/** Bonjour forwards its constructor options to multicast-dns, but its typings only declare the service fields. */
function multicastOptions(address: string): ConstructorParameters<typeof Bonjour>[0] {
  return { interface: address, bind: '0.0.0.0' } as ConstructorParameters<typeof Bonjour>[0];
}

/**
 * Advertises the server on the LAN over mDNS (`_ottlib._tcp`) so native clients can find it without typing an address.
 *
 * One responder per LAN address: left to itself, multicast-dns sends replies through the OS default multicast
 * interface, which on Windows is often a disconnected or virtual adapter (169.254.x.x) with a lower metric than
 * Wi-Fi, so queries arrive but the answers never reach the TV.
 */
export class DiscoveryService {
  private responders: Bonjour[] = [];

  public constructor(private readonly log: { warn(message: string): void; info(message: string): void }) {}

  public start(name: string, port: number, addresses: string[]): void {
    for (const address of addresses) {
      try {
        const responder = new Bonjour(multicastOptions(address), (error: Error) => this.log.warn(`mDNS advertisement on ${address} failed: ${error.message}`));
        // Probing is skipped: responders on several interfaces of the same host would otherwise see each other as conflicts.
        // `.local` makes clients resolve the host over mDNS (Windows hostnames lack it). The A records list every adapter,
        // including 169.254.x.x ones, so the address this responder serves is also sent in TXT for clients to prefer.
        responder.publish({ name, type: discoveryServiceType, port, host: `${hostname()}.local`, disableIPv6: true, probe: false, txt: { apiVersion: String(apiVersion), address } });
        this.responders.push(responder);
      } catch (error) { this.log.warn(`mDNS advertisement on ${address} unavailable: ${error instanceof Error ? error.message : String(error)}`); }
    }
    if (this.responders.length) this.log.info(`Advertising "${name}" over mDNS on ${addresses.join(', ')}`);
  }

  public async stop(): Promise<void> {
    const responders = this.responders; this.responders = [];
    await Promise.all(responders.map((responder) => new Promise<void>((resolve) => responder.unpublishAll(() => responder.destroy(() => resolve())))));
  }
}
