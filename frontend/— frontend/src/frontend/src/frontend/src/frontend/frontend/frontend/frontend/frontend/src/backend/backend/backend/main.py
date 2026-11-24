from fastapi import FastAPI
from pydantic import BaseModel
from analyzer import analyze

app = FastAPI(title="AMED CRASH AI — API d'analyse")

class Payload(BaseModel):
    multipliers: list[float]
    window: int = 50
    threshold: float = 2.0

@app.post("/analyze")
def run(p: Payload):
    return analyze(p.multipliers, p.window, p.threshold)

@app.get("/health")
def health(): return {"status": "ok"}
