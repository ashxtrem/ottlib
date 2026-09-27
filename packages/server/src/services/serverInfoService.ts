import { readFileSync } from 'node:fs';
import { hostname, networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
import { apiVersion, type ServerInfo } from '@ottlib/shared';

const packageVersion = (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version;

export class ServerInfoService {
  public constructor(private readonly port: number) {}
  public get(): ServerInfo {
    const addresses = Object.values(networkInterfaces()).flat().filter((network): network is NetworkInterfaceInfo => Boolean(network && network.family === 'IPv4' && !network.internal && !network.address.startsWith('169.254.'))).map((network) => network.address);
    return { name: this.name(), version: packageVersion, apiVersion, port: this.port, addresses };
  }
  public name(): string { return `Ottlib on ${hostname()}`; }
}
