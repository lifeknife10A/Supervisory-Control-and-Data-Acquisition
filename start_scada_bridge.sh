#!/usr/bin/env bash
# Startup script for SCADA FastAPI Bridge Server
echo "=========================================================="
echo "  Starting SCADA LabVIEW & React Telemetry Bridge Server  "
echo "  Port: http://localhost:8000                            "
echo "=========================================================="

cd "$(dirname "$0")/backend"
if [ -d ".venv" ]; then
    .venv/bin/python server.py
else
    python3 server.py
fi
