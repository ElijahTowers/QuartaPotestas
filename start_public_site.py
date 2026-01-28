#!/usr/bin/env python3
"""
Script om alle services te starten voor de public site via Cloudflare tunnels.

Dit script start automatisch:
1. PocketBase (poort 8090)
2. FastAPI backend (poort 8000)
3. Next.js frontend (poort 3000)
4. Cloudflare tunnel voor frontend (in nieuwe terminal)
5. Cloudflare tunnel voor PocketBase (in nieuwe terminal)
6. Configureert .env.local met de PocketBase tunnel URL

VOORWAARDEN:
- cloudflared moet geïnstalleerd zijn: brew install cloudflared
- Backend venv moet bestaan: cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
- Frontend dependencies: cd frontend && npm install

GEBRUIK:
    python start_public_site.py

OF:
    ./start_public_site.py

Het script opent 2 nieuwe terminal vensters voor de Cloudflare tunnels.
Kopieer de URLs die verschijnen en voer ze in wanneer gevraagd.

Om te stoppen: Druk Ctrl+C in dit script.
"""

import subprocess
import sys
import os
import time
import re
import signal
from pathlib import Path
from typing import Optional, List

# Project root directory
PROJECT_ROOT = Path(__file__).parent.absolute()
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
POCKETBASE_BINARY = BACKEND_DIR / "pocketbase"
ENV_LOCAL = FRONTEND_DIR / ".env.local"

# Processen die we moeten beheren
processes: List[subprocess.Popen] = []


def check_cloudflared():
    """Check of cloudflared geïnstalleerd is."""
    try:
        result = subprocess.run(
            ["cloudflared", "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            print("✓ cloudflared is geïnstalleerd")
            return True
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    
    print("✗ cloudflared is niet geïnstalleerd")
    print("  Installeer met: brew install cloudflared")
    return False


def check_pocketbase():
    """Check of PocketBase binary bestaat."""
    if POCKETBASE_BINARY.exists() and os.access(POCKETBASE_BINARY, os.X_OK):
        print("✓ PocketBase binary gevonden")
        return True
    print("✗ PocketBase binary niet gevonden of niet uitvoerbaar")
    return False


def start_pocketbase():
    """Start PocketBase server."""
    print("\n🚀 Start PocketBase...")
    try:
        process = subprocess.Popen(
            [str(POCKETBASE_BINARY), "serve"],
            cwd=BACKEND_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        processes.append(process)
        time.sleep(2)  # Wacht even tot PocketBase opgestart is
        if process.poll() is None:
            print("✓ PocketBase gestart (poort 8090)")
            return True
        else:
            print("✗ PocketBase start gefaald")
            return False
    except Exception as e:
        print(f"✗ Fout bij starten PocketBase: {e}")
        return False


def start_backend():
    """Start FastAPI backend."""
    print("\n🚀 Start FastAPI backend...")
    try:
        # Check of venv bestaat
        venv_python = BACKEND_DIR / "venv" / "bin" / "python"
        if not venv_python.exists():
            print("✗ Backend venv niet gevonden. Maak eerst venv aan:")
            print(f"  cd {BACKEND_DIR} && python -m venv venv")
            return False
        
        process = subprocess.Popen(
            [str(venv_python), "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
            cwd=BACKEND_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        processes.append(process)
        time.sleep(3)  # Wacht even tot backend opgestart is
        if process.poll() is None:
            print("✓ FastAPI backend gestart (poort 8000)")
            return True
        else:
            print("✗ Backend start gefaald")
            return False
    except Exception as e:
        print(f"✗ Fout bij starten backend: {e}")
        return False


def start_frontend():
    """Start Next.js frontend."""
    print("\n🚀 Start Next.js frontend...")
    try:
        # Check of node_modules bestaat
        if not (FRONTEND_DIR / "node_modules").exists():
            print("✗ node_modules niet gevonden. Installeer eerst dependencies:")
            print(f"  cd {FRONTEND_DIR} && npm install")
            return False
        
        process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=FRONTEND_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        processes.append(process)
        time.sleep(5)  # Wacht even tot frontend opgestart is
        if process.poll() is None:
            print("✓ Next.js frontend gestart (poort 3000)")
            return True
        else:
            print("✗ Frontend start gefaald")
            return False
    except Exception as e:
        print(f"✗ Fout bij starten frontend: {e}")
        return False


def extract_tunnel_url(output: str) -> Optional[str]:
    """Extract tunnel URL uit cloudflared output."""
    # Zoek naar URL pattern: https://xxxxx.trycloudflare.com
    pattern = r'https://[a-z0-9-]+\.trycloudflare\.com'
    match = re.search(pattern, output)
    if match:
        return match.group(0)
    return None


def start_cloudflare_tunnel(port: int, name: str) -> Optional[str]:
    """Start Cloudflare tunnel en return de URL."""
    print(f"\n🚀 Start Cloudflare tunnel voor {name} (poort {port})...")
    try:
        process = subprocess.Popen(
            ["cloudflared", "tunnel", "--url", f"http://localhost:{port}"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        processes.append(process)
        
        # Wacht tot we een URL zien in de output
        url = None
        for _ in range(30):  # Max 30 seconden wachten
            time.sleep(1)
            if process.poll() is not None:
                # Process is gestopt, lees output
                output, _ = process.communicate()
                print(f"✗ Tunnel voor {name} gefaald: {output}")
                return None
            
            # Probeer output te lezen (non-blocking)
            try:
                # We kunnen niet non-blocking lezen, dus we gebruiken een timeout
                pass
            except:
                pass
        
        # Lees de output na een korte wachttijd
        time.sleep(3)
        try:
            # Probeer de laatste regels te lezen
            # Dit is een workaround omdat we niet non-blocking kunnen lezen
            # In productie zou je threading gebruiken
            pass
        except:
            pass
        
        # Voor nu: vraag gebruiker om URL handmatig in te voeren
        print(f"⏳ Wacht op Cloudflare tunnel URL voor {name}...")
        print(f"   Kijk in de terminal output voor de URL (https://xxxxx.trycloudflare.com)")
        print(f"   Of voer handmatig in:")
        
        # We kunnen de URL niet automatisch extraheren zonder threading
        # Laat de gebruiker het handmatig doen of gebruik een andere aanpak
        return None
        
    except Exception as e:
        print(f"✗ Fout bij starten tunnel voor {name}: {e}")
        return None


def start_cloudflare_tunnel_with_output(port: int, name: str) -> subprocess.Popen:
    """Start Cloudflare tunnel en return het process."""
    print(f"\n🚀 Start Cloudflare tunnel voor {name} (poort {port})...")
    try:
        # Start in een nieuwe terminal (macOS)
        if sys.platform == "darwin":
            script = f"""
            tell application "Terminal"
                do script "cd '{PROJECT_ROOT}' && echo 'Cloudflare tunnel voor {name} (poort {port})' && cloudflared tunnel --url http://localhost:{port}"
            end tell
            """
            subprocess.run(["osascript", "-e", script], check=False)
            print(f"✓ Terminal geopend voor {name} tunnel")
            print(f"   Kopieer de URL uit de nieuwe terminal venster")
            # Return None omdat we het process niet kunnen beheren in een nieuwe terminal
            return None
        else:
            # Fallback: start in background (Linux/Windows)
            process = subprocess.Popen(
                ["cloudflared", "tunnel", "--url", f"http://localhost:{port}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            processes.append(process)
            print(f"✓ Tunnel gestart voor {name} (check output voor URL)")
            return process
    except Exception as e:
        print(f"✗ Fout bij starten tunnel voor {name}: {e}")
        return None


def configure_env_local(pb_url: str):
    """Configureer .env.local met PocketBase tunnel URL."""
    print(f"\n📝 Configureer .env.local...")
    try:
        content = f"NEXT_PUBLIC_POCKETBASE_URL={pb_url}\n"
        ENV_LOCAL.write_text(content)
        print(f"✓ .env.local geconfigureerd met PocketBase URL: {pb_url}")
        print(f"   ⚠️  Herstart de frontend server om de wijzigingen door te voeren!")
        return True
    except Exception as e:
        print(f"✗ Fout bij configureren .env.local: {e}")
        return False


def cleanup():
    """Stop alle processen."""
    print("\n\n🛑 Stop alle services...")
    for process in processes:
        try:
            process.terminate()
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        except Exception:
            pass
    print("✓ Alle services gestopt")


def signal_handler(sig, frame):
    """Handle Ctrl+C."""
    cleanup()
    sys.exit(0)


def main():
    """Hoofdfunctie."""
    print("=" * 60)
    print("Quarta Potestas - Public Site Setup")
    print("=" * 60)
    
    # Register signal handler
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Checks
    if not check_cloudflared():
        sys.exit(1)
    
    if not check_pocketbase():
        sys.exit(1)
    
    # Start services
    if not start_pocketbase():
        cleanup()
        sys.exit(1)
    
    if not start_backend():
        cleanup()
        sys.exit(1)
    
    if not start_frontend():
        cleanup()
        sys.exit(1)
    
    # Start tunnels (in nieuwe terminals)
    print("\n" + "=" * 60)
    print("🌐 Cloudflare Tunnels")
    print("=" * 60)
    print("\nEr worden nu 2 nieuwe terminal vensters geopend voor de tunnels.")
    print("Wacht even tot de URLs verschijnen, kopieer ze en voer ze hieronder in.\n")
    
    start_cloudflare_tunnel_with_output(3000, "Frontend")
    time.sleep(3)
    start_cloudflare_tunnel_with_output(8090, "PocketBase")
    
    # Wacht even zodat tunnels kunnen opstarten
    print("\n⏳ Wacht 5 seconden tot tunnels opstarten...")
    time.sleep(5)
    
    # Vraag gebruiker om URLs
    print("\n" + "=" * 60)
    print("📋 Configureer Tunnel URLs")
    print("=" * 60)
    print("\nKijk in de nieuwe terminal vensters voor de tunnel URLs.")
    print("Ze zien eruit als: https://xxxxx.trycloudflare.com\n")
    
    frontend_url = input("Voer de Frontend tunnel URL in (of druk Enter om over te slaan): ").strip()
    pb_url = input("Voer de PocketBase tunnel URL in (of druk Enter om over te slaan): ").strip()
    
    if pb_url:
        configure_env_local(pb_url)
        print("\n⚠️  BELANGRIJK: Herstart de frontend server om .env.local te laden!")
        print("   Stop de frontend (Ctrl+C in dit script) en start opnieuw:")
        print("   cd frontend && npm run dev")
    else:
        print("\n⚠️  PocketBase URL niet geconfigureerd.")
        print("   Configureer handmatig in frontend/.env.local:")
        print("   NEXT_PUBLIC_POCKETBASE_URL=https://xxxxx.trycloudflare.com")
    
    print("\n" + "=" * 60)
    print("✅ Alle services zijn gestart!")
    print("=" * 60)
    print(f"\nFrontend URL: {frontend_url}")
    print(f"PocketBase URL: {pb_url}")
    print("\nDruk Ctrl+C om alle services te stoppen.\n")
    
    # Wacht tot gebruiker Ctrl+C drukt
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()


if __name__ == "__main__":
    main()

