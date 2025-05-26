# Backend Scripts

This directory contains scripts for managing and running the backend service. Both PowerShell (.ps1) and Shell (.sh) scripts are provided to support Windows and Linux/macOS environments.

## Startup Scripts

- `start_server.ps1` / `start_server.sh` - Start the web service

## Database Scripts

- `init_db.py` - Initialize the database, create necessary tables
- `init_users.py` - Create initial users, including admin and test users with various roles

## Usage

### Windows Environment

```powershell
cd backend\scripts
.\start_server.ps1
```

### Linux/macOS Environment

```bash
cd backend/scripts
chmod +x start_server.sh  # First time only
./start_server.sh
```

### Notes

- All scripts should be run from the `backend/scripts` directory
- The startup scripts will automatically set the working directory and Python path
- Log files are saved in the `logs` directory in the project root
- The scripts do not create virtual environments or install dependencies
- Make sure you have all dependencies installed before running the scripts
