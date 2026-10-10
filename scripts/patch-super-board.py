"""Apply narrow Windows CLI compatibility fixes to pinned super-board launchers."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
for name in ['super-board-codex-lane.sh','super-board-codex-wave.sh']:
 path = root/'.claude/bin'/name
 text = path.read_text(encoding='utf-8')
 if 'import shutil\n' not in text:
  text = text.replace('import subprocess\n','import subprocess\nimport shutil\n')
 text = text.replace("command = ['codex', 'exec',", "command = [shutil.which('codex.cmd' if os.name == 'nt' else 'codex') or 'codex', 'exec',")
 path.write_text(text,encoding='utf-8',newline='\n')
print('Windows Codex executable resolution patched (idempotent).')
# GitHub bodies written by Windows clients may contain CRLF.
path = root/'.claude/bin/super-board-deps.sh'
text = path.read_text(encoding='utf-8')
text = text.replace('( . / "\\n" ) as $lines', '( gsub("\\r"; "") / "\\n" ) as $lines')
path.write_text(text,encoding='utf-8',newline='\n')
print('Dependency heading CRLF handling patched (idempotent).')
