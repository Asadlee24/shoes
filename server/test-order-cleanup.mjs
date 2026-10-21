// Explicit owner request on 21 October: all existing requests were test data.
// Freeze the boundary so later orders and subsequent deployments stay untouched.
export const testCleanupRevision = "owner-test-request-cleanup-2026-10-21";
export const testCleanupBefore = "2026-10-21T10:44:48.000Z";

// Call inside the store's write transaction. Keep records and receipts privately
// recoverable through Archived requests; never send cancellation emails for tests.
export async function archiveOwnerTestRequests(store) {
  const db = store.db;
  if (
    await db
      .prepare("SELECT id FROM migrations WHERE id=?")
      .get(testCleanupRevision)
  )
    return;
  const rows = await db
    .prepare("SELECT id,kind,status,data FROM requests WHERE created<=?")
    .all(testCleanupBefore);
  const archivedAt = new Date().toISOString();
  for (const row of rows) {
    const data = JSON.parse(row.data);
    const reviews = await db
      .prepare("SELECT id,status FROM reviews WHERE request_id=?")
      .all(row.id);
    const returned = [];
    if (row.kind === "order" && row.status !== "cancelled") {
      for (const item of data.items || []) {
        if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0)
          continue;
        const product = await store.product(item.id);
        if (product && Number.isInteger(product.stockBySize?.[item.size])) {
          product.stockBySize[item.size] += item.quantity;
          if (Number.isInteger(product.stock)) product.stock += item.quantity;
          await store.saveProduct(product);
          returned.push({
            id: item.id,
            size: item.size,
            quantity: item.quantity,
          });
        }
      }
    }
    data.testCleanup = {
      revision: testCleanupRevision,
      previousStatus: row.status,
      previousArchivedAt: data.archivedAt || null,
      returnedStock: returned,
      reviewStatuses: reviews,
    };
    data.archivedAt ||= archivedAt;
    await db
      .prepare("UPDATE requests SET status=?,data=? WHERE id=?")
      .run(
        row.kind === "order" ? "cancelled" : row.status,
        JSON.stringify(data),
        row.id,
      );
    await db
      .prepare("UPDATE reviews SET status='rejected' WHERE request_id=?")
      .run(row.id);
    await db
      .prepare(
        "UPDATE email_outbox SET status='archived',last_error='Archived test request; delivery stopped.' WHERE request_id=? AND status IN ('pending','sending','failed','unknown')",
      )
      .run(row.id);
  }
  // Restocked sizes can produce a fresh alert on a future low-stock crossing.
  for (const product of await store.products())
    for (const size of product.sizes || []) {
      if (
        Number.isInteger(product.stockBySize?.[size]) &&
        product.stockBySize[size] > 2
      )
        await db
          .prepare("UPDATE stock_alert_state SET low=0 WHERE id=?")
          .run(`${product.id}:${size}`);
    }
  await db
    .prepare("INSERT INTO migrations(id,applied) VALUES(?,?)")
    .run(testCleanupRevision, archivedAt);
}
