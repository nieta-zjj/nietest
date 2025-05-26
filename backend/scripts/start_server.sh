#!/bin/bash
# Start backend service
# This script is used to start the backend web service

# Color definitions
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}===================================${NC}"
echo -e "${CYAN}Starting Backend Service${NC}"
echo -e "${CYAN}===================================${NC}"

# Set environment variables
export PYTHONPATH=$(pwd)
cd ..
echo -e "${GREEN}[+] Working directory set to: $(pwd)${NC}"

# Create logs directory if it doesn't exist
if [ ! -d "logs" ]; then
    mkdir -p logs
    echo -e "${GREEN}[+] Logs directory created${NC}"
fi

# Start web service
echo ""
echo -e "${CYAN}===================================${NC}"
echo -e "${CYAN}Starting Web Service...${NC}"
echo -e "${CYAN}===================================${NC}"
echo -e "${YELLOW}[!] Web service will run in the foreground, closing this window will stop the service${NC}"
echo -e "${YELLOW}[!] Press Ctrl+C to stop the web service${NC}"
echo -e "${CYAN}===================================${NC}"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo -e "${CYAN}===================================${NC}"
    echo -e "${CYAN}Web service stopped${NC}"
    echo -e "${CYAN}===================================${NC}"
    exit 0
}

# Capture Ctrl+C signal
trap cleanup SIGINT

# Start web service
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# If web service exits naturally, also perform cleanup
cleanup
