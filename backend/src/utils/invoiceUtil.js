async function getNextInvoiceNo(tx) {
  // Query only the last 50 orders sorted by createdAt desc to avoid full table scans.
  // We exclude invoice numbers starting with '9' as they are temporary draft numbers.
  const recentOrders = await tx.order.findMany({
    where: {
      invoiceNo: {
        not: { startsWith: '9' }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 50,
    select: { invoiceNo: true }
  });

  const numericInvoices = recentOrders
    .map(o => parseInt(o.invoiceNo))
    .filter(num => !isNaN(num));

  const maxNum = numericInvoices.length > 0 ? Math.max(...numericInvoices) : 99;
  return (maxNum + 1).toString();
}

module.exports = {
  getNextInvoiceNo
};
