#!/usr/bin/env bash
# Attend que le conteneur d'essai réponde (entrypoint : migrations, seeds, import CSV).
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3400/login || true)
  if [ "$code" = "200" ]; then echo "prêt après $((i*5)) s"; exit 0; fi
  if ! sudo -n docker ps --format '{{.Names}}' | grep -q '^gleba_essai$'; then echo "conteneur arrêté"; sudo -n docker logs --tail 30 gleba_essai; exit 1; fi
  sleep 5
done
echo "pas prêt après 300 s"; sudo -n docker logs --tail 30 gleba_essai; exit 1
