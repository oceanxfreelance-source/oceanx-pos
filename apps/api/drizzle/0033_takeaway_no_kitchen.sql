-- Takeaway shops: takeaway only and no kitchen screen (they can switch either back on in Settings > POS).
UPDATE "business_settings" bs
SET "settings" = jsonb_set(
  COALESCE(bs."settings", '{}'::jsonb),
  '{pos}',
  COALESCE(bs."settings"->'pos', '{}'::jsonb) || jsonb_build_object(
    'takeawayOnly', true,
    'sendToKitchen', false,
    'defaultOrderType', CASE WHEN bs."settings"->'pos'->>'defaultOrderType' = 'delivery' THEN 'delivery' ELSE 'takeaway' END
  )
)
FROM "businesses" b
WHERE b."id" = bs."business_id" AND b."business_type" = 'takeaway';
