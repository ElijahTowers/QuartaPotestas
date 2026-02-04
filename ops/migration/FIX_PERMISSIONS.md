# Fix Permissions Issue

Als je "Operation not permitted" krijgt, probeer dit:

## Oplossing 1: Clone naar nieuwe locatie

```bash
cd ~
git clone https://github.com/ElijahTowers/QuartaPotestas.git QuartaPotestas-new
cd QuartaPotestas-new
chmod +x ops/migration/ONE_COMMAND_SETUP.sh
./ops/migration/ONE_COMMAND_SETUP.sh
```

## Oplossing 2: Check permissions

```bash
# Check waar je bent
pwd

# Ga naar home directory
cd ~

# Clone opnieuw
git clone https://github.com/ElijahTowers/QuartaPotestas.git
cd QuartaPotestas
chmod +x ops/migration/ONE_COMMAND_SETUP.sh
./ops/migration/ONE_COMMAND_SETUP.sh
```

## Oplossing 3: Full Disk Access

Als het probleem blijft:
1. System Settings → Privacy & Security → Full Disk Access
2. Voeg Terminal toe
3. Herstart Terminal
4. Probeer opnieuw

