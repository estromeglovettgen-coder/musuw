import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMonthlyAmount, annualAmountForMonthly, formatMarketPrice, sortMarketProducts } from './marketplacePresentation.ts'

test('creator pricing accepts exact cents and previews a year as ten monthly charges', () => {
  assert.equal(parseMonthlyAmount('19.99'), 1999)
  assert.equal(annualAmountForMonthly(1999), 19990)
  assert.equal(parseMonthlyAmount('0.29'), 29)
  for (const invalid of ['', '0', '-1', '1e3', '1.001', 'abc']) assert.equal(parseMonthlyAmount(invalid), null)
  assert.equal(formatMarketPrice(19990, 'USD', 'en-US'), '$199.90')
})

test('featured products precede ordinary products and test items never displace them', () => {
  const products = [
    { id: 'test', featured: true, fixture: true },
    { id: 'regular', featured: false, fixture: false },
    { id: 'taylor', featured: true, fixture: false },
  ]
  assert.deepEqual(sortMarketProducts(products).map(p => p.id), ['taylor', 'regular', 'test'])
  assert.equal(products[0].id, 'test')
})
