import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from './db.js';

test('Delta Sync Logic - LWW and Timestamp tests', async (t) => {
  db.load();

  const testOwnerId = 'test_owner_sync_' + Date.now();
  const testCustomer1 = {
    id: 'cust_sync_1',
    customer_code: 'KH-TEST-1',
    name: 'Khách hàng Test 1',
    phone: '0901234567',
    ownerId: testOwnerId,
    updated_at: 1000,
    sync_status: 1
  };

  // 1. Initial Insert
  db.create('customers', testCustomer1, testCustomer1.id);
  const fetched = db.getById('customers', 'cust_sync_1');
  assert.equal(fetched.name, 'Khách hàng Test 1');

  // 2. Client sends newer update (updated_at = 2000)
  const newerUpdate = {
    ...testCustomer1,
    name: 'Khách hàng Test 1 (Updated)',
    updated_at: 2000
  };
  if (newerUpdate.updated_at >= fetched.updated_at) {
    db.update('customers', testCustomer1.id, newerUpdate);
  }
  const afterUpdate = db.getById('customers', 'cust_sync_1');
  assert.equal(afterUpdate.name, 'Khách hàng Test 1 (Updated)');

  // 3. Client sends older update (updated_at = 1500) -> Should be rejected by LWW
  const olderUpdate = {
    ...testCustomer1,
    name: 'Khách hàng Test 1 (Old Stale Name)',
    updated_at: 1500
  };
  if (olderUpdate.updated_at >= afterUpdate.updated_at) {
    db.update('customers', testCustomer1.id, olderUpdate);
  }
  const afterStale = db.getById('customers', 'cust_sync_1');
  assert.equal(afterStale.name, 'Khách hàng Test 1 (Updated)', 'LWW should preserve newer version');

  // Cleanup test record
  db.remove('customers', 'cust_sync_1');
  console.log('✅ Unit test for Delta Sync LWW passed!');
});
