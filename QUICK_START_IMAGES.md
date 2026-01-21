# Quick Start: Image Generation Test

## Stap 1: Start Ollama

In een terminal venster:

```bash
# Check of Ollama draait
ollama list

# Als het niet draait, start het:
ollama serve
```

Laat dit venster open staan.

## Stap 2: Start Stable Diffusion

In een **nieuwe** terminal venster, ga naar je Stable Diffusion directory:

```bash
cd ~/stable-diffusion-webui  # of waar je het hebt geïnstalleerd
./webui.sh --api --listen
```

**Belangrijk:** De `--api` flag is nodig zodat de backend er mee kan praten!

Laat dit venster ook open staan. Het kan even duren voordat het opstart.

## Stap 3: Test de Prompts (Optioneel)

Als je eerst alleen de prompts wilt zien die gegenereerd worden:

```bash
cd /Users/lowiehartjes/CursorProjects/QuartaPotestas/backend
source /Users/lowiehartjes/opt/anaconda3/etc/profile.d/conda.sh
conda activate quartapotestas
python test_prompts_only.py
```

Dit toont je wat voor prompts er naar Stable Diffusion gestuurd worden.

## Stap 4: Genereer Voorbeeld Images

Zodra beide draaien (Ollama + Stable Diffusion), run:

```bash
cd /Users/lowiehartjes/CursorProjects/QuartaPotestas/backend
source /Users/lowiehartjes/opt/anaconda3/etc/profile.d/conda.sh
conda activate quartapotestas
python test_image_generation.py
```

Dit script:
- ✅ Controleert of Ollama en Stable Diffusion draaien
- ✅ Genereert prompts voor 5 voorbeeld scoops
- ✅ Genereert images met Stable Diffusion
- ✅ Slaat ze op in `backend/test_images/`

## Wat je zult zien

Het script test met deze 5 voorbeeld scoops:

1. **Swiss deadly fire bar owners' lawyers condemn 'vindictiveness'**
   - Location: Switzerland
   - Style: Factual, documentary

2. **Japanese Prime Minister Takaichi calls an early election**
   - Location: Japan
   - Style: Political news

3. **Tech Giant Announces Revolutionary AI Breakthrough**
   - Location: San Francisco
   - Style: Technology news

4. **Climate Summit Ends with Historic Agreement**
   - Location: Geneva
   - Style: International news

5. **World Leaders Gather in Secret Summit**
   - Location: Global
   - Style: Global politics

## Output

De gegenereerde images worden opgeslagen als:
- `test_01_Swiss_deadly_fire_bar_owners_lawyers...png`
- `test_02_Japanese_Prime_Minister_Takaichi...png`
- etc.

In de directory: `backend/test_images/`

## Troubleshooting

### "Cannot connect to Stable Diffusion"
- Check of Stable Diffusion draait: `curl http://127.0.0.1:7860/sdapi/v1/options`
- Zorg dat je `--api --listen` flags gebruikt bij het starten

### "Ollama is not available"
- Start Ollama: `ollama serve`
- Check of je model geïnstalleerd is: `ollama list`

### Images worden niet gegenereerd
- Check de Stable Diffusion terminal voor errors
- Images kunnen 10-30 seconden duren (GPU) of 2-5 minuten (CPU)
- Check of je genoeg VRAM/geheugen hebt

### Images zien er niet uit als vintage krantenfoto's
- De prompts worden automatisch aangevuld met "vintage newspaper photograph, black and white, grainy texture"
- Als het niet werkt, kunnen we de prompts aanpassen

## Volgende Stappen

Zodra de test images er goed uitzien:
1. ✅ Images worden automatisch gegenereerd bij nieuwe scoops
2. ✅ Images worden opgeslagen in `backend/app/static/images/`
3. ✅ Frontend kan ze tonen via `/static/images/article_{id}.png`

