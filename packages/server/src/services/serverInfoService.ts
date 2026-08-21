import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';

export class ServerInfoService {
  public constructor(private readonly port: number) {}
  public get() {
    const addresses = Object.values(networkInterfaces()).flat().filter((network): network is NetworkInterfaceInfo => Boolean(network && network.family === 'IPv4' && !network.internal && !network.address.startsWith('169.254.'))).map((network) => network.address);
    return { port: this.port, addresses };
  }
}
