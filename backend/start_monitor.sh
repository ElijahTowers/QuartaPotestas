#!/bin/bash
# Start Ollama Monitor in a new terminal window

cd "$(dirname "$0")"

# Check OS and open in appropriate terminal
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - open in new Terminal window
    osascript -e "tell application \"Terminal\" to do script \"cd '$(pwd)' && python3 monitor_ollama.py\""
    echo "✅ Monitor opent in een nieuw Terminal venster"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - try to open in new terminal
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd '$(pwd)' && python3 monitor_ollama.py; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -e "cd '$(pwd)' && python3 monitor_ollama.py" &
    else
        echo "Start handmatig: python3 monitor_ollama.py"
    fi
else
    echo "Start handmatig: python3 monitor_ollama.py"
fi

