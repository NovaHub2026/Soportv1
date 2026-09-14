import { SimulatedOrbitRecords } from './simulated-orbit-records.js';

describe('SimulatedOrbitRecords (PH-4.1)', () => {
  it('answers a masked summary for a simulated customer and labels the source', async () => {
    const lookup = await new SimulatedOrbitRecords({}).customerSummary('cust-alice');
    expect(lookup.state).toBe('available');
    if (lookup.state !== 'available') throw new Error('unexpected');
    expect(lookup.source).toBe('simulated');
    expect(lookup.data).toMatchObject({ username: 'alice.souza', emailMasked: 'a***@e***.com', phoneMasked: '+55 ••• ••• 1234', verificationStatus: 'verified' });
    expect(JSON.stringify(lookup)).not.toContain('alice.souza@');
    expect(JSON.stringify(lookup)).not.toContain('99999');
  });

  it('answers not_found for an unknown customer and unavailable in outage mode (RULE-SUP-07 negatives)', async () => {
    await expect(new SimulatedOrbitRecords({}).customerSummary('cust-nobody')).resolves.toMatchObject({ state: 'unavailable', reason: 'not_found' });
    await expect(new SimulatedOrbitRecords({ SUPPORT_SIMULATED_ORBIT: 'unavailable' }).customerSummary('cust-alice')).resolves.toMatchObject({
      state: 'unavailable',
      reason: 'unavailable',
    });
  });
});
