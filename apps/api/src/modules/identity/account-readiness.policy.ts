import type { Identity } from '@clinic/contracts';
import type { ManagerAccount } from './identity.repository.js';
export function onboardingStage(account: ManagerAccount): Identity['stage'] {
  if (account.temporaryExpiresAt) return 'password';
  if (!account.verifiedEmail && (account.isManager || account.loginMethod === 'email'))
    return 'email';
  if (account.isManager && !account.codesSaved) return 'codes';
  return 'ready';
}
