insert into payment_fee_rates (payment_type, label, percent, fixed_idr) values
  ('qris', 'QRIS (0,7%, termasuk PPN)', 0.7, 0),
  ('gopay', 'GoPay (2%, termasuk PPN)', 2, 0),
  ('shopeepay', 'ShopeePay (2%, termasuk PPN)', 2, 0),
  ('bank_transfer', 'Virtual Account (Rp4.000 + PPN)', 0, 4440),
  ('echannel', 'Mandiri Bill/VA (Rp4.000 + PPN)', 0, 4440),
  ('credit_card', 'Kartu (2,9% + Rp2.000, + PPN)', 3.219, 2220),
  ('cstore', 'Gerai retail (Rp5.000)', 0, 5000),
  ('akulaku', 'Akulaku (1,7% + PPN)', 1.887, 0),
  ('kredivo', 'Kredivo (2% + PPN)', 2.22, 0)
on conflict (payment_type) do update set label = excluded.label, percent = excluded.percent, fixed_idr = excluded.fixed_idr, updated_at = now();
