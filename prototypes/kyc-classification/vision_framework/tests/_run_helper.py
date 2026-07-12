"""Helper: run a test script and print its output safely."""
import os, sys, subprocess

script = sys.argv[1]
env = dict(os.environ)
env["PYTHONIOENCODING"] = "utf-8"
env["PYTHONUTF8"] = "1"

r = subprocess.run(
    [sys.executable, script],
    env=env,
    cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
)
sys.exit(r.returncode)
