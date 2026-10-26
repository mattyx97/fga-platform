#!/usr/bin/env bash
# kimi-setup — porta un progetto "Claude Code" dentro Kimi Code CLI.
#
# Cosa fa (tutto idempotente, rilanciabile senza danni):
#   1. Installa il Kimi Code CLI nativo se manca (e avvisa se trova il vecchio CLI Python)
#   2. Garantisce ~/.kimi-code/bin nel PATH di ~/.zshrc
#   3. Aggiunge extra_skill_dirs = [".claude/skills"] a ~/.kimi-code/config.toml
#   4. Crea il symlink AGENTS.md -> CLAUDE.md (Kimi legge solo AGENTS.md)
#   5. Crea symlink .agents/skills -> .claude/skills (progetto e, se esiste, globale):
#      convenzione cross-tool, così altri agent oltre a Kimi leggono le stesse skill
#   6. Copia i server MCP da Claude Code (~/.claude.json e .mcp.json di progetto)
#      in ~/.kimi-code/mcp.json / .kimi-code/mcp.json, fondendo senza cancellare
#   7. Valida la config con `kimi doctor`
#
# Uso:  ./scripts/kimi-setup.sh [root-del-progetto]   (default: directory corrente)

set -euo pipefail

KIMI_HOME="${KIMI_CODE_HOME:-$HOME/.kimi-code}"
PROJECT_ROOT="$(cd "${1:-.}" && pwd)"
export PATH="$KIMI_HOME/bin:$HOME/.local/bin:$PATH"

say()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }

# --- 1. CLI -------------------------------------------------------------------
say "Kimi Code CLI"

if command -v uv >/dev/null 2>&1 && uv tool list 2>/dev/null | grep -q '^kimi-cli'; then
  warn "Trovato il vecchio kimi-cli Python. Rimuovilo con:  uv tool uninstall kimi-cli"
fi

if command -v kimi >/dev/null 2>&1 && kimi doctor --help >/dev/null 2>&1; then
  ok "CLI già installato ($(kimi --version 2>/dev/null)) — per aggiornare: kimi upgrade"
else
  curl -fsSL https://code.kimi.com/kimi-code/install.sh | bash
  ok "CLI installato in $KIMI_HOME/bin"
fi

# --- 2. PATH in .zshrc ---------------------------------------------------------
if [ -f "$HOME/.zshrc" ] && ! grep -q 'kimi-code/bin' "$HOME/.zshrc"; then
  echo 'export PATH="$HOME/.kimi-code/bin:$PATH"' >> "$HOME/.zshrc"
  ok "PATH aggiunto a ~/.zshrc"
fi

# --- 3. config.toml: extra_skill_dirs ------------------------------------------
say "Skill da .claude/skills"
mkdir -p "$KIMI_HOME"
CONFIG="$KIMI_HOME/config.toml"

if [ -f "$CONFIG" ] && grep -q '^[[:space:]]*extra_skill_dirs' "$CONFIG"; then
  ok "extra_skill_dirs già presente"
elif [ -f "$CONFIG" ]; then
  # chiave top-level: va prima di qualsiasi [sezione], quindi in testa al file
  { printf 'extra_skill_dirs = [".claude/skills"]\n\n'; cat "$CONFIG"; } > "$CONFIG.new"
  mv "$CONFIG.new" "$CONFIG"
  ok "extra_skill_dirs aggiunto in testa a config.toml"
else
  printf 'extra_skill_dirs = [".claude/skills"]\n' > "$CONFIG"
  ok "config.toml creato con extra_skill_dirs (il login completerà il resto al primo avvio)"
fi

# --- 4. AGENTS.md -> CLAUDE.md ---------------------------------------------------
say "Istruzioni di progetto"
cd "$PROJECT_ROOT"

if [ -e AGENTS.md ]; then
  ok "AGENTS.md già presente"
elif [ -f CLAUDE.md ]; then
  ln -s CLAUDE.md AGENTS.md
  ok "AGENTS.md -> CLAUDE.md (symlink: un solo file sorgente)"
else
  warn "Nessun CLAUDE.md in $PROJECT_ROOT, salto"
fi

# --- 5. Skill cross-tool (.agents/skills) -------------------------------------------
say "Skill cross-tool (.agents/skills)"

# progetto: .agents/skills -> .claude/skills
if [ -d .claude/skills ]; then
  if [ -e .agents/skills ]; then
    ok ".agents/skills già presente"
  else
    mkdir -p .agents
    ln -s ../.claude/skills .agents/skills
    ok ".agents/skills -> .claude/skills"
  fi
else
  warn "Nessuna .claude/skills in $PROJECT_ROOT, salto il link di progetto"
fi

# globale: ~/.agents/skills -> ~/.claude/skills (solo se hai skill globali in Claude)
if [ -d "$HOME/.claude/skills" ]; then
  if [ -e "$HOME/.agents/skills" ]; then
    ok "~/.agents/skills già presente"
  else
    mkdir -p "$HOME/.agents"
    ln -s "$HOME/.claude/skills" "$HOME/.agents/skills"
    ok "~/.agents/skills -> ~/.claude/skills"
  fi
fi

# --- 6. MCP da Claude Code -------------------------------------------------------
say "Server MCP"

python3 - "$KIMI_HOME" "$PROJECT_ROOT" <<'PYEOF'
import json, os, shutil, sys, datetime

kimi_home, project_root = sys.argv[1], sys.argv[2]

def convert(cfg):
    if 'command' in cfg:                       # stdio
        out = {'command': cfg['command']}
        for k in ('args', 'env', 'cwd'):
            if k in cfg:
                out[k] = cfg[k]
        return out
    out = {'url': cfg['url']}                  # http / sse
    if cfg.get('type') == 'sse':
        out['transport'] = 'sse'
    if 'headers' in cfg:
        out['headers'] = cfg['headers']
    return out

def merge_into(dst, servers, label):
    if not servers:
        return
    merged = {}
    if os.path.exists(dst):
        with open(dst) as f:
            merged = json.load(f).get('mcpServers', {})
        shutil.copy(dst, dst + '.' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '.bak')
    merged.update({name: convert(cfg) for name, cfg in servers.items()})
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'w') as f:
        json.dump({'mcpServers': merged}, f, indent=2)
    print(f"  ✓ {label}: {', '.join(servers)} -> {dst}")

# globali: ~/.claude.json -> ~/.kimi-code/mcp.json
claude_json = os.path.expanduser('~/.claude.json')
if os.path.exists(claude_json):
    with open(claude_json) as f:
        data = json.load(f)
    merge_into(os.path.join(kimi_home, 'mcp.json'), data.get('mcpServers'), 'globali')
    merge_into(os.path.join(kimi_home, 'mcp.json'),
               data.get('projects', {}).get(project_root, {}).get('mcpServers'), 'progetto (da ~/.claude.json)')
else:
    print('  ! ~/.claude.json non trovato, salto i server globali')

# di progetto: .mcp.json -> .kimi-code/mcp.json (stesso formato, stessa visibilità)
proj_mcp = os.path.join(project_root, '.mcp.json')
if os.path.exists(proj_mcp):
    with open(proj_mcp) as f:
        merge_into(os.path.join(project_root, '.kimi-code', 'mcp.json'),
                   json.load(f).get('mcpServers'), 'progetto (.mcp.json)')
PYEOF

# --- 7. Validazione ---------------------------------------------------------------
if command -v kimi >/dev/null 2>&1 && kimi doctor --help >/dev/null 2>&1; then
  say "Validazione"
  kimi doctor config "$KIMI_HOME/config.toml"
fi

cat <<'NOTE'

Fatto. Ricorda:
  - I server MCP con OAuth (es. atlassian) vanno ri-autorizzati in Kimi:
    /mcp-config login <nome-server>   (stato: /mcp)
  - Le modifiche a Claude Code NON si propagano più automaticamente:
    rilancia questo script per riallineare MCP e skill.
  - Apri un nuovo terminale (o `source ~/.zshrc`) e avvia `kimi` dalla root del progetto.
NOTE
