"""Read-only local workflow validation; never dispatches a worker."""
import json, os, shutil, subprocess, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
os.chdir(root)
os.environ['PYTHONUTF8']='1'
config=json.loads((root/'.claude/super-board/configs/clinic-mvp.json').read_text())
errors=[]
def require(ok,message):
 print(('PASS ' if ok else 'FAIL ')+message)
 if not ok: errors.append(message)
require(config['project']['number']==1 and config['project']['owner']=='aymanobeid0','GitHub project identity')
require(config['columns']==['Backlog','Ready','Building','QA','Review','Blocked','Done'],'seven workflow statuses')
require(config['human_approves_merge'] is True and config['merge_policy']['default']=='human','every merge requires a human')
require(config['max_workers']==1,'one concurrent card')
require(not config['migrations']['allowed_envs'],'no automatic database migrations')
require(config['verify_commands']==['bash scripts/verify-app.sh'],'real application verification gate')
require((root/'CLAUDE.md').read_text(encoding='utf-8-sig').strip()=='@AGENTS.md','one project instruction source')
for name in ['super-board','super-build','super-qa','super-review','super-collect','visual','git-sync','ui-refine-loop','tdd','grilling','code-review','to-spec','to-tickets']:
 require((root/'.agents/skills'/name/'SKILL.md').is_file(),f'Codex skill {name}')
bash=Path('C:/Program Files/Git/bin/bash.exe') if os.name=='nt' else Path(shutil.which('bash') or '')
require(bash.is_file(),'Git Bash available')
if bash.is_file():
 for script in ['.claude/bin/super-board-codex-lane.sh','.claude/bin/super-board-codex-wave.sh','scripts/verify-app.sh','scripts/git-hooks/pre-push']:
  require(subprocess.run([str(bash),'-n',script]).returncode==0,f'shell syntax {script}')
 for script in ['.claude/bin/super-board-codex-lane.sh','.claude/bin/super-board-codex-wave.sh']:
  source=(root/script).read_text().split("<<'PY'\n",1)[1].rsplit('\nPY',1)[0]
  try: compile(source,script,'exec'); require(True,f'Python syntax {script}')
  except SyntaxError: require(False,f'Python syntax {script}')
require(subprocess.run([sys.executable,'.claude/bin/super-board-agents-md.py','check','--file','AGENTS.md']).returncode==0,'agent instruction markers and size')
print('Application checks: not yet available; verify-app.sh intentionally blocks an empty app.')
sys.exit(1 if errors else 0)
