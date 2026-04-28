export interface IdentityAssertion {
  provider: 'ESIA';
  subject: string;
  assertedAt: Date;
}

export interface IdentityVerificationProvider {
  /**
   * Returns provider authorization URL for the user.
   * Provider-specific state/nonce must be embedded into the URL.
   */
  getAuthorizationRedirectUrl(params: {
    userId: string;
    attemptId: string;
  }): Promise<string>;

  /**
   * Exchanges callback code for an identity assertion.
   * Must throw on invalid/expired codes.
   */
  exchangeCodeForAssertion(params: {
    code: string;
    attemptId: string;
    userId: string;
  }): Promise<IdentityAssertion>;
}
