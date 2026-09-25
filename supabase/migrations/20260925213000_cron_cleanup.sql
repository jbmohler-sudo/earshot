-- The poller writes a cron.job_run_details row every 30 seconds (~2,900/day). Keep one day.
select cron.schedule(
  'earshot-cron-history-cleanup',
  '17 * * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '1 day' $$
);
