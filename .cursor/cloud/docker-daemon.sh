#!/usr/bin/env bash
# Ensure a working Docker daemon for the Compose backend stack.
#
# WHAT: start dockerd and make same-network containers reachable.
# HOW: launch dockerd in the background (the VM has no systemd) and set the
#      bridge netfilter sysctls to 0.
# WHY: the VM runs Docker nested. Overlay-on-overlay needs the fuse-overlayfs
#      storage driver, and same-bridge traffic must skip iptables or the mixed
#      legacy/nft rulesets silently drop container-to-container packets.
set -euo pipefail

if ! sudo docker info >/dev/null 2>&1; then
  sudo rm -f /var/run/docker.pid
  sudo bash -c 'nohup dockerd >/tmp/dockerd.log 2>&1 &'
  for _ in $(seq 1 30); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi

if ! sudo docker info >/dev/null 2>&1; then
  echo "dockerd failed to start; last log lines:" >&2
  tail -n 20 /tmp/dockerd.log >&2 || true
  exit 1
fi

# docker0 creation loads br_netfilter, after which these sysctls exist.
if [ -e /proc/sys/net/bridge/bridge-nf-call-iptables ]; then
  sudo sysctl -wq net.bridge.bridge-nf-call-iptables=0
  sudo sysctl -wq net.bridge.bridge-nf-call-ip6tables=0
fi
