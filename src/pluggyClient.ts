import { PluggyClient } from 'pluggy-sdk';
import { Config } from './config.js';

export function createPluggyClient(config: Config): PluggyClient {
  return new PluggyClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });
}
