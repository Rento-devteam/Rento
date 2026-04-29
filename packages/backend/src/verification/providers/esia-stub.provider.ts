import type {
  IdentityAssertion,
  IdentityVerificationProvider,
} from './identity-verification.provider';

export class EsiaStubVerificationProvider implements IdentityVerificationProvider {
  getAuthorizationRedirectUrl(params: {
    userId: string;
    attemptId: string;
  }): Promise<string> {
    const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';

    // Redirect to a backend stub endpoint that simulates ESIA decision.
    // `deny=1` path allows testing the alternative flow without UI.
    const url = new URL('/verify/esia/stub', baseUrl);
    url.searchParams.set('attemptId', params.attemptId);
    return Promise.resolve(url.toString());
  }

  exchangeCodeForAssertion(params: {
    code: string;
    attemptId: string;
    userId: string;
  }): Promise<IdentityAssertion> {
    if (!params.code || params.code.trim().length === 0) {
      throw new Error('Missing code');
    }

    return Promise.resolve({
      provider: 'ESIA',
      subject: `stub:${params.userId}`,
      assertedAt: new Date(),
    });
  }
}
