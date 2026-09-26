import sys

with open("app/components/EtiquetasRapidas.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("export default function EtiquetasRapidas() {")
if idx == -1:
    print("Could not find")
    sys.exit(1)

head = text[:idx]
with open("head.js", "w", encoding="utf-8") as f:
    f.write(head)
