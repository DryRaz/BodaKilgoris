// Run with: npm run test:unit   (Node >= 22.18 strips the types natively)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidPin, normalizePhone, normalizePlate } from './phone.ts';

test('every common way of typing the same Kenyan number gives the same stored format', () => {
  const same = [
    '+254702181688', '254702181688', '0702181688', '702181688',
    '+254 702 181 688', '0702 181 688', '0702-181-688', '(0702) 181688', '+254 0702181688',
  ];
  for (const input of same) assert.equal(normalizePhone(input), '+254702181688', input);
});

test('01xx numbers (Safaricom/Airtel new range) are accepted', () => {
  assert.equal(normalizePhone('0112345678'), '+254112345678');
  assert.equal(normalizePhone('+254112345678'), '+254112345678');
});

test('invalid numbers are rejected', () => {
  for (const bad of ['', '12345', '+254802181688', '0802181688', '+25470218168', '+2547021816889', 'abc', null, undefined, 702181688]) {
    assert.equal(normalizePhone(bad), null, String(bad));
  }
});

test('stored format matches the DB check profiles.phone ~ ^\\+254[17][0-9]{8}$', () => {
  const stored = normalizePhone('0702181688')!;
  assert.match(stored, /^\+254[17][0-9]{8}$/);
});

test('plate + pin helpers', () => {
  assert.equal(normalizePlate(' kmfa  123a '), 'KMFA 123A');
  assert.equal(normalizePlate('!!'), null);
  assert.ok(isValidPin('1234'));
  assert.ok(!isValidPin('123') && !isValidPin('12345') && !isValidPin('12a4') && !isValidPin(1234));
});
