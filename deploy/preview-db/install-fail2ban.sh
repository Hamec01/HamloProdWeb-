#!/bin/sh
# Run again after recreating PgBouncer: Docker json-file paths contain its ID.
set -eu
[ "$(id -u)" = 0 ] || { echo 'Run using sudo.' >&2; exit 1; }
task_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
driver=$(docker inspect --format '{{.HostConfig.LogConfig.Type}}' hamloprod-pgbouncer)
[ "$driver" = json-file ] || { echo 'Expected Docker json-file logging.' >&2; exit 1; }
log_path=$(docker inspect --format '{{.LogPath}}' hamloprod-pgbouncer)
case "$log_path" in /var/lib/docker/containers/*/*-json.log) ;; *) echo 'Unexpected log path.' >&2; exit 1;; esac
[ -f "$log_path" ]
install -o root -g root -m 644 "$task_dir/pgbouncer-fail2ban.conf" /etc/fail2ban/filter.d/hamloprod-pgbouncer.conf
cat > /etc/fail2ban/jail.d/hamloprod-pgbouncer.local <<EOF
[hamloprod-pgbouncer]
enabled = true
filter = hamloprod-pgbouncer
backend = polling
logpath = $log_path tail
usedns = no
maxretry = 6
findtime = 600
bantime = 3600
ignoreip = 127.0.0.1/8 ::1
action = iptables[name=hamloprod-pgb, port=6432, protocol=tcp, chain=DOCKER-USER, blocktype=DROP]
EOF
chmod 644 /etc/fail2ban/jail.d/hamloprod-pgbouncer.local
fail2ban-client -t
fail2ban-client reload
fail2ban-client status hamloprod-pgbouncer
