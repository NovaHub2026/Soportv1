import { resolveIdentityProviderName } from './identity.module.js';
import { SimulatedOrbitIdentity } from './simulated-orbit-identity.js';

describe('resolveIdentityProviderName', () => {
  it('defaults to the simulated provider outside production', () => {
    expect(resolveIdentityProviderName({})).toBe('simulated');
    expect(resolveIdentityProviderName({ NODE_ENV: 'development' })).toBe('simulated');
  });

  it('refuses unknown providers', () => {
    expect(() => resolveIdentityProviderName({ SUPPORT_IDENTITY_PROVIDER: 'orbit' })).toThrow(/Unknown identity provider/);
  });

  it('refuses to run the simulated provider in production without an explicit opt-in (negative case)', () => {
    expect(() => resolveIdentityProviderName({ NODE_ENV: 'production' })).toThrow(/must not run in production/);
    expect(() => resolveIdentityProviderName({ NODE_ENV: 'Production' })).toThrow(/must not run in production/);
    expect(() => resolveIdentityProviderName({ NODE_ENV: ' PRODUCTION ' })).toThrow(/must not run in production/);
    expect(resolveIdentityProviderName({ NODE_ENV: 'production', SUPPORT_ALLOW_SIMULATED_IDENTITY: 'true' })).toBe('simulated');
  });
});

describe('SimulatedOrbitIdentity', () => {
  const provider = new SimulatedOrbitIdentity();

  it('resolves a customer or a staff member from headers and labels the source', async () => {
    await expect(provider.resolve({ 'x-simulated-customer-id': 'cust-1' })).resolves.toEqual({
      kind: 'customer',
      id: 'cust-1',
      source: 'simulated',
    });
    await expect(
      provider.resolve({ 'x-simulated-staff-id': 'staff-carla', 'x-simulated-staff-role': 'supervisor', 'x-simulated-staff-name': 'Carla' }),
    ).resolves.toEqual({ kind: 'staff', id: 'staff-carla', role: 'supervisor', displayName: 'Carla', source: 'simulated' });
    // PH-7.2: the directory decides the role; a header that disagrees is ignored, an unknown id is nobody.
    await expect(provider.resolve({ 'x-simulated-staff-id': 'staff-ana', 'x-simulated-staff-role': 'supervisor' })).resolves.toMatchObject({ role: 'agent' });
    await expect(provider.resolve({ 'x-simulated-staff-id': 'staff-1', 'x-simulated-staff-role': 'supervisor' })).resolves.toBeNull();
  });

  it('returns no actor for missing, ambiguous, malformed or unknown-role headers (negative cases)', async () => {
    await expect(provider.resolve({})).resolves.toBeNull();
    await expect(provider.resolve({ 'x-simulated-customer-id': 'cust-1', 'x-simulated-staff-id': 'staff-1' })).resolves.toBeNull();
    await expect(provider.resolve({ 'x-simulated-customer-id': 'not valid!' })).resolves.toBeNull();
    await expect(provider.resolve({ 'x-simulated-staff-id': 'staff-ana', 'x-simulated-staff-role': 'owner' })).resolves.toBeNull();
  });
});
