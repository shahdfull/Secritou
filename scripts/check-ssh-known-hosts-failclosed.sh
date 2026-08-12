#!/usr/bin/env bash
# SEC-024: proves that backup.yml's SSH connection mechanism (UserKnownHostsFile fed by the
# SSH_KNOWN_HOSTS secret, BatchMode-equivalent non-interactive connection) fails CLOSED — not
# silently — when the known_hosts file is empty, i.e. when SSH_KNOWN_HOSTS has never been
# configured. This is the state backup.yml is in today (no production server yet, secret unset).
#
# Does not exercise backup.yml directly (that needs a real SSH_HOST) — instead proves the
# underlying SSH behavior it relies on, against a local sshd started just for this check. No
# external network dependency, no Docker image pull: openssh-server is Ubuntu's standard package,
# already present or installable via apt on the ubuntu-latest GitHub Actions runner this targets.
#
# Two assertions:
#   1. Empty known_hosts -> ssh exits non-zero with "Host key verification failed" (fail-closed
#      confirmed — this is the state before SSH_KNOWN_HOSTS is ever set).
#   2. Correct known_hosts (as ssh-keyscan would produce, and as the checklist in backup.yml /
#      REFERENTIEL.md instructs the operator to paste into the secret) -> ssh connects
#      successfully (confirms the mechanism isn't just failing everything by accident).
#
# Usage: bash scripts/check-ssh-known-hosts-failclosed.sh
# Exit 0 = both assertions hold. Exit 1 = fail-closed behavior is broken (would mean
# StrictHostKeyChecking-style silent bypass is back, or the mechanism never connects at all).

set -euo pipefail

WORKDIR=$(mktemp -d)
trap 'sudo kill "${SSHD_PID:-0}" 2>/dev/null; rm -rf "$WORKDIR"' EXIT

SSHD_PORT=2222
HOST_KEY="$WORKDIR/ssh_host_ed25519_key"
CLIENT_KEY="$WORKDIR/client_key"
SSHD_CONFIG="$WORKDIR/sshd_config"
AUTHORIZED_KEYS="$WORKDIR/authorized_keys"
EMPTY_KNOWN_HOSTS="$WORKDIR/empty_known_hosts"
CORRECT_KNOWN_HOSTS="$WORKDIR/correct_known_hosts"

echo "==> Generating host key (simulates the production server's SSH host key)"
ssh-keygen -t ed25519 -f "$HOST_KEY" -N "" -q

echo "==> Generating client key (simulates SSH_PRIVATE_KEY)"
ssh-keygen -t ed25519 -f "$CLIENT_KEY" -N "" -q
cp "$CLIENT_KEY.pub" "$AUTHORIZED_KEYS"

cat > "$SSHD_CONFIG" <<EOF
Port $SSHD_PORT
ListenAddress 127.0.0.1
HostKey $HOST_KEY
AuthorizedKeysFile $AUTHORIZED_KEYS
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
UsePAM no
PidFile $WORKDIR/sshd.pid
# StrictModes checks ownership/permissions on the home dir and .ssh path leading up to
# AuthorizedKeysFile — irrelevant here since this is a throwaway sshd in a mktemp dir for this
# check only, not a real server config (never disabled in backup.yml or the real deployment path).
StrictModes no
EOF
chmod 600 "$AUTHORIZED_KEYS"

SSHD_BIN=$(command -v sshd || echo /usr/sbin/sshd)
if [ ! -x "$SSHD_BIN" ]; then
  echo "sshd not found — this check requires openssh-server (apt-get install openssh-server on the runner)."
  exit 1
fi

# sshd's privilege-separation directory — present on a full Ubuntu install but missing in a
# minimal container image (observed failure: "Missing privilege separation directory: /run/sshd").
if [ ! -d /run/sshd ]; then
  sudo mkdir -p /run/sshd
fi

# The GitHub Actions "runner" account (and a freshly useradd'd account in a minimal container)
# has no password set, which OpenSSH's own account-status check treats as locked — independent of
# UsePAM/StrictModes, confirmed via sshd -e logs: "User runner not allowed because account is
# locked" (auth_shadow_acctexpired), rejecting publickey auth before it even inspects the key.
# Setting a placeholder crypt string ('*', standard "no valid password, pubkey-only" convention —
# never a real password) unlocks the account for this throwaway local sshd without touching how
# the real production host's account is provisioned (unrelated to this check).
sudo usermod -p '*' "$(whoami)"

echo "==> Starting local sshd on 127.0.0.1:$SSHD_PORT"
sudo "$SSHD_BIN" -f "$SSHD_CONFIG" -D &
SSHD_PID=$!
sleep 1

if ! kill -0 "$SSHD_PID" 2>/dev/null; then
  echo "sshd failed to start"
  exit 1
fi

touch "$EMPTY_KNOWN_HOSTS"

echo "==> Assertion 1: empty known_hosts must fail closed (Host key verification failed)"
set +e
SSH_OUTPUT=$(ssh -o UserKnownHostsFile="$EMPTY_KNOWN_HOSTS" \
  -o BatchMode=yes -o ConnectTimeout=3 -o Port="$SSHD_PORT" \
  -i "$CLIENT_KEY" 127.0.0.1 "echo should-not-run" 2>&1)
SSH_EXIT=$?
set -e

if [ "$SSH_EXIT" -eq 0 ]; then
  echo "FAIL: ssh succeeded with an empty known_hosts file — fail-closed behavior is broken."
  echo "$SSH_OUTPUT"
  exit 1
fi
if ! echo "$SSH_OUTPUT" | grep -qi "host key verification failed"; then
  echo "FAIL: ssh failed as expected (exit $SSH_EXIT) but not with the expected message:"
  echo "$SSH_OUTPUT"
  exit 1
fi
echo "    OK — exit $SSH_EXIT, \"Host key verification failed\""

echo "==> Assertion 2: correct known_hosts (as ssh-keyscan would produce) must connect successfully"
ssh-keyscan -p "$SSHD_PORT" 127.0.0.1 > "$CORRECT_KNOWN_HOSTS" 2>/dev/null

set +e
SSH_OUTPUT=$(ssh -o UserKnownHostsFile="$CORRECT_KNOWN_HOSTS" \
  -o BatchMode=yes -o ConnectTimeout=3 -o Port="$SSHD_PORT" \
  -i "$CLIENT_KEY" 127.0.0.1 "echo connection-works" 2>&1)
SSH_EXIT=$?
set -e

if [ "$SSH_EXIT" -ne 0 ] || [ "$SSH_OUTPUT" != "connection-works" ]; then
  echo "FAIL: ssh with a correctly pinned known_hosts did not connect as expected (exit $SSH_EXIT):"
  echo "$SSH_OUTPUT"
  exit 1
fi
echo "    OK — connected, remote command executed"

echo "==> Both assertions passed: the SSH_KNOWN_HOSTS mechanism used by backup.yml fails closed"
echo "    when unset, and connects correctly when set — as ssh-keyscan output would produce."
