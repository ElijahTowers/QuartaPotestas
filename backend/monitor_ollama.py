#!/usr/bin/env python3
"""
Ollama Instance Monitor
Monitors local Ollama instance and displays loaded models in a live dashboard.
"""

import httpx
import asyncio
import time
from typing import Optional, Dict, Any
from rich.console import Console
from rich.live import Live
from rich.table import Table
from rich.panel import Panel
from rich.layout import Layout
from rich.text import Text
from datetime import datetime

# Configuration
OLLAMA_BASE_URL = "http://localhost:11434"
POLL_INTERVAL = 1.0  # seconds


class OllamaMonitor:
    def __init__(self, base_url: str = OLLAMA_BASE_URL):
        self.base_url = base_url
        self.console = Console()
        self.client = httpx.AsyncClient(timeout=2.0)
        self.last_status = "Unknown"
        self.last_error = None

    async def check_ollama_status(self) -> tuple[bool, Optional[str]]:
        """Check if Ollama is online"""
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            if response.status_code == 200:
                return True, None
            else:
                return False, f"HTTP {response.status_code}"
        except httpx.ConnectError:
            return False, "Connection refused"
        except httpx.TimeoutException:
            return False, "Timeout"
        except Exception as e:
            return False, str(e)

    async def get_loaded_models(self) -> list[Dict[str, Any]]:
        """Get currently loaded models from /api/ps"""
        try:
            response = await self.client.get(f"{self.base_url}/api/ps")
            if response.status_code == 200:
                data = response.json()
                return data.get("models", [])
            else:
                return []
        except Exception:
            return []

    def format_memory(self, size_bytes: Optional[int]) -> str:
        """Format memory size in human-readable format"""
        if size_bytes is None:
            return "N/A"
        
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} PB"

    def format_vram(self, vram_bytes: Optional[int]) -> str:
        """Format VRAM size"""
        return self.format_memory(vram_bytes)

    def get_processor_type(self, model_data: Dict[str, Any]) -> str:
        """Determine processor type (CPU vs GPU)"""
        # Check if GPU is being used (Ollama typically shows this in model info)
        # We can infer from memory usage patterns or check for GPU-specific fields
        vram = model_data.get("size_vram")
        if vram and vram > 0:
            return "GPU"
        return "CPU"

    def create_table(self, is_online: bool, models: list[Dict[str, Any]]) -> Table:
        """Create a Rich table with current status"""
        table = Table(
            title="Ollama Monitor",
            show_header=True,
            header_style="bold magenta",
            border_style="blue",
            title_style="bold white",
        )
        
        table.add_column("Status", style="bold", width=12)
        table.add_column("Model", style="cyan", width=40)
        table.add_column("Memory", style="green", width=15)
        table.add_column("VRAM", style="yellow", width=15)
        table.add_column("Processor", style="blue", width=10)
        table.add_column("Created", style="dim", width=20)

        if not is_online:
            table.add_row(
                "[red]Offline[/red]",
                "[dim]N/A[/dim]",
                "[dim]N/A[/dim]",
                "[dim]N/A[/dim]",
                "[dim]N/A[/dim]",
                "[dim]N/A[/dim]",
            )
        elif not models:
            table.add_row(
                "[green]Online[/green]",
                "[yellow]Idle[/yellow]",
                "[dim]—[/dim]",
                "[dim]—[/dim]",
                "[dim]—[/dim]",
                "[dim]—[/dim]",
            )
        else:
            for model in models:
                status = "[green]Online[/green]"
                model_name = model.get("name", "Unknown")
                memory = self.format_memory(model.get("size"))
                vram = self.format_vram(model.get("size_vram"))
                processor = self.get_processor_type(model)
                
                # Format created timestamp
                created_at = model.get("created_at")
                if created_at:
                    try:
                        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                        created_str = dt.strftime("%Y-%m-%d %H:%M:%S")
                    except:
                        created_str = created_at
                else:
                    created_str = "N/A"

                table.add_row(
                    status,
                    model_name,
                    memory,
                    vram,
                    processor,
                    created_str,
                )

        return table

    def create_info_panel(self, is_online: bool, error: Optional[str], model_count: int) -> Panel:
        """Create info panel with connection status"""
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        if is_online:
            status_text = Text("● Online", style="bold green")
            info_lines = [
                f"Status: {status_text}",
                f"Ollama URL: {self.base_url}",
                f"Models Loaded: {model_count}",
                f"Last Update: {current_time}",
            ]
        else:
            status_text = Text("● Offline", style="bold red")
            error_info = f"Error: {error}" if error else "Unknown error"
            info_lines = [
                f"Status: {status_text}",
                f"Ollama URL: {self.base_url}",
                f"{error_info}",
                f"Last Update: {current_time}",
            ]

        info_text = "\n".join(info_lines)
        return Panel(
            info_text,
            title="[bold]Connection Info[/bold]",
            border_style="blue",
            padding=(1, 2),
        )

    async def update_display(self, live: Live):
        """Update the display with current Ollama status"""
        is_online, error = await self.check_ollama_status()
        self.last_status = "Online" if is_online else "Offline"
        self.last_error = error

        models = []
        if is_online:
            models = await self.get_loaded_models()

        # Create layout
        layout = Layout()
        layout.split_column(
            Layout(name="info", size=7),
            Layout(name="table"),
        )

        # Add panels
        layout["info"].update(self.create_info_panel(is_online, error, len(models)))
        layout["table"].update(self.create_table(is_online, models))

        live.update(layout)

    async def run(self):
        """Main monitoring loop"""
        self.console.print("[bold green]Starting Ollama Monitor...[/bold green]")
        self.console.print(f"Polling {self.base_url} every {POLL_INTERVAL} second(s)\n")

        try:
            with Live(console=self.console, refresh_per_second=1/POLL_INTERVAL) as live:
                while True:
                    await self.update_display(live)
                    await asyncio.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            self.console.print("\n[bold yellow]Monitoring stopped by user[/bold yellow]")
        finally:
            await self.client.aclose()


async def main():
    """Entry point"""
    import sys

    # Allow custom Ollama URL via command line argument
    ollama_url = sys.argv[1] if len(sys.argv) > 1 else OLLAMA_BASE_URL

    monitor = OllamaMonitor(base_url=ollama_url)
    await monitor.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nExiting...")


