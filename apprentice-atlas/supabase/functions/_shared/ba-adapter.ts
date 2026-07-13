import { SourceConfigurationError } from './source-adapter.ts';

export const BA_OFFICIAL_CONTRACT_UNCONFIRMED = 'BA_OFFICIAL_CONTRACT_UNCONFIRMED';

export function createBaAdapter(): never {
  throw new SourceConfigurationError(
    'The official Bundesagentur für Arbeit read API contract is not confirmed; BA synchronization is disabled.',
    BA_OFFICIAL_CONTRACT_UNCONFIRMED,
  );
}
