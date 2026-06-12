const fs = require('fs');

const collections = [
  'customers', 'orders', 'products', 'inventory_logs', 
  'payments', 'debts', 'checkins', 'audit_logs', 
  'attendance_logs', 'finance_transactions', 'price_lists',
  'payment_requests', 'coupons'
];

const indexes = [];

collections.forEach(col => {
  // Owner index
  indexes.push({
    collectionGroup: col,
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "ownerId", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" }
    ]
  });
  
  // Employee index
  indexes.push({
    collectionGroup: col,
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "ownerId", order: "ASCENDING" },
      { fieldPath: "createdByEmail", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" }
    ]
  });
});

fs.writeFileSync('firestore.indexes.json', JSON.stringify({ indexes, fieldOverrides: [] }, null, 2));
console.log('Done rewriting firestore.indexes.json');
