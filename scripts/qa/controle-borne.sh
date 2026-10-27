#!/usr/bin/env bash
# Un seul contrôle lourd sur le VPS ; tous ses descendants restent dans le cgroup.
set -euo pipefail

if (( $# == 0 )); then
  echo 'Usage : scripts/qa/controle-borne.sh COMMANDE [ARGUMENTS...]' >&2
  exit 64
fi

qa_memory_mb=${GLEBA_QA_MEMORY_MB:-1024}
if ! [[ "$qa_memory_mb" =~ ^[0-9]+$ ]] || (( qa_memory_mb < 256 || qa_memory_mb > 2048 )); then
  echo 'GLEBA_QA_MEMORY_MB doit être compris entre 256 et 2048.' >&2
  exit 64
fi
[[ $(stat -fc %T /sys/fs/cgroup) == cgroup2fs ]] || { echo 'cgroup v2 requis.' >&2; exit 69; }

exec 9>/tmp/gleba-build.lock
flock -n 9 || { echo 'Un contrôle lourd détient déjà le verrou global.' >&2; exit 75; }
qa_available_mb=$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
qa_required_mb=$((qa_memory_mb + 1024))
if (( qa_available_mb < qa_required_mb )); then
  echo "Contrôle reporté : ${qa_available_mb} Mio disponibles ; ${qa_required_mb} Mio requis." >&2
  exit 75
fi

qa_unit="gleba-qa-$(date +%s)-$$"
qa_user=$(id -un)
cleanup() { sudo -n systemctl stop "$qa_unit.scope" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP
echo "Contrôle exclusif : cgroup ${qa_memory_mb} Mio, swap interdit, CPU 75 %, marge hôte 1024 Mio."
sudo -n systemd-run --scope --quiet --collect --unit="$qa_unit" \
  --property="MemoryMax=${qa_memory_mb}M" --property=MemorySwapMax=0 \
  --property=CPUQuota=75% --property=TasksMax=256 \
  --property=RuntimeMaxSec=180 \
  runuser -u "$qa_user" -- "$@"
