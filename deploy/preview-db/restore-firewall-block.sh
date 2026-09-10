#!/bin/sh
# Restore the PgBouncer connection-rate guard after Docker recreates its chains.
# fail2ban installs its own jump ahead of this rule when its jail starts.
set -eu

IPTABLES=/usr/sbin/iptables
PUBLIC_IP=84.247.130.242
PUBLIC_PORT=6432

"$IPTABLES" -w 10 -S DOCKER-USER >/dev/null

# Remove the temporary deny-all rule used while PgBouncer was being prepared.
while "$IPTABLES" -w 10 -C DOCKER-USER -p tcp -m conntrack \
  --ctorigdst "$PUBLIC_IP" --ctorigdstport "$PUBLIC_PORT" -j DROP 2>/dev/null; do
  "$IPTABLES" -w 10 -D DOCKER-USER -p tcp -m conntrack \
    --ctorigdst "$PUBLIC_IP" --ctorigdstport "$PUBLIC_PORT" -j DROP
done

if ! "$IPTABLES" -w 10 -C DOCKER-USER -p tcp -m conntrack --ctstate NEW \
  --ctorigdst "$PUBLIC_IP" --ctorigdstport "$PUBLIC_PORT" \
  -m hashlimit --hashlimit-above 60/minute --hashlimit-burst 30 \
  --hashlimit-mode srcip --hashlimit-name hamloprod6432 \
  --hashlimit-htable-expire 60000 -j DROP 2>/dev/null; then
  "$IPTABLES" -w 10 -I DOCKER-USER 1 -p tcp -m conntrack --ctstate NEW \
    --ctorigdst "$PUBLIC_IP" --ctorigdstport "$PUBLIC_PORT" \
    -m hashlimit --hashlimit-above 60/minute --hashlimit-burst 30 \
    --hashlimit-mode srcip --hashlimit-name hamloprod6432 \
    --hashlimit-htable-expire 60000 -j DROP
fi
