-- Run the Last.fm poller every 30 seconds. URL and shared secret live in Vault
-- (set out-of-band so the secret never appears in migration history).

select cron.schedule(
  'earshot-poller',
  '30 seconds',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'earshot_poller_url'),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-poller-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'earshot_poller_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- The Vault secrets are in place; remove the one-time setter.
drop function public.earshot_set_vault_secret(text, text);
