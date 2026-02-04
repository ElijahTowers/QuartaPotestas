# SSH Setup voor Mac Mini

Om via SSH te verbinden met de Mac Mini:

## 1. Check IP Adres van Mac Mini

Op de Mac Mini, run:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Of:
```bash
ipconfig getifaddr en0
```

Noteer het IP adres (bijv. 192.168.1.84)

## 2. Check of SSH actief is

Op de Mac Mini:
```bash
sudo systemsetup -getremotelogin
```

Moet "Remote Login: On" zeggen.

Als het "Off" is:
```bash
sudo systemsetup -setremotelogin on
```

## 3. Check Firewall

Op de Mac Mini:
- System Settings → Network → Firewall
- Zorg dat "Allow incoming connections" aan staat
- Of voeg Terminal/SSH toe aan de uitzonderingen

## 4. Test Connectie

Vanaf je MacBook:
```bash
ssh lowie@192.168.1.84
```

Als het werkt, kun je gewoon inloggen.

## 5. SSH Key Setup (optioneel, voor passwordless login)

Op je MacBook:
```bash
ssh-copy-id lowie@192.168.1.84
```

Dan hoef je geen wachtwoord meer in te voeren.

## Troubleshooting

### "No route to host"
- Check of beide machines op hetzelfde WiFi zitten
- Check IP adres: `ping 192.168.1.84`
- Check of Mac Mini niet in slaapstand is

### "Connection refused"
- SSH is niet actief: `sudo systemsetup -setremotelogin on`
- Firewall blokkeert: Check firewall settings

### "Permission denied"
- Verkeerd wachtwoord
- Gebruiker heeft geen SSH toegang

