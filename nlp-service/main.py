"""
Social Pulse NLP Service.
FastAPI microservice providing high-precision local sentiment signals:
- VADER sentiment analysis
- Emoji sentiment & extraction
- Multilingual & English transformer models (via Hugging Face pipeline)
- Irony & emotion classification
- Script & language identification
"""

import os
import re
import unicodedata
from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import emoji
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# ─── Data Models ─────────────────────────────────────────────────────────────

class ContextModel(BaseModel):
    videoTitle: Optional[str] = None
    parentText: Optional[str] = None

class ItemModel(BaseModel):
    id: str
    text: str
    context: Optional[ContextModel] = None

class AnalyzeRequest(BaseModel):
    items: List[ItemModel] = Field(..., max_length=64)

class SignalModel(BaseModel):
    vader: Optional[Dict[str, float]] = None
    hfSentiment: Optional[Dict[str, Any]] = None
    hfIrony: Optional[Dict[str, float]] = None
    hfEmotion: Optional[Dict[str, Any]] = None
    emoji: Optional[Dict[str, Any]] = None
    lexicon: Optional[Dict[str, float]] = None
    lang: Optional[Dict[str, str]] = None

class ItemResult(BaseModel):
    id: str
    sentiment: str
    score: float
    confidence: float
    emotion: str
    language: str
    isSarcastic: bool
    isMixed: bool
    signals: SignalModel

class AnalyzeResponse(BaseModel):
    results: List[ItemResult]

# ─── Global State & Warmup ───────────────────────────────────────────────────

vader_analyzer = SentimentIntensityAnalyzer()
models_loaded = False
transformer_pipelines: Dict[str, Any] = {}

def load_models():
    global models_loaded, transformer_pipelines
    # We attempt to load transformers if installed and enabled
    enable_hf = os.environ.get("ENABLE_HF_TRANSFORMERS", "true").lower() == "true"
    if enable_hf:
        try:
            from transformers import pipeline
            # Sentiment pipeline (cardiffnlp/twitter-roberta-base-sentiment-latest)
            try:
                transformer_pipelines["sentiment"] = pipeline(
                    "sentiment-analysis",
                    model="cardiffnlp/twitter-roberta-base-sentiment-latest",
                    device=-1, # CPU
                    top_k=None,
                )
            except Exception as e:
                print(f"[WARN] Could not load twitter-roberta-base-sentiment-latest: {e}")

            # Multilingual sentiment
            try:
                transformer_pipelines["multilingual"] = pipeline(
                    "sentiment-analysis",
                    model="cardiffnlp/twitter-xlm-roberta-base-sentiment",
                    device=-1,
                    top_k=None,
                )
            except Exception as e:
                print(f"[WARN] Could not load twitter-xlm-roberta-base-sentiment: {e}")

            # Irony pipeline
            try:
                transformer_pipelines["irony"] = pipeline(
                    "text-classification",
                    model="cardiffnlp/twitter-roberta-base-irony",
                    device=-1,
                )
            except Exception as e:
                print(f"[WARN] Could not load twitter-roberta-base-irony: {e}")

            # Emotion pipeline
            try:
                transformer_pipelines["emotion"] = pipeline(
                    "text-classification",
                    model="j-hartmann/emotion-english-distilroberta-base",
                    device=-1,
                    top_k=None,
                )
            except Exception as e:
                print(f"[WARN] Could not load emotion-english-distilroberta-base: {e}")

            models_loaded = True
        except ImportError:
            print("[INFO] transformers library not loaded; running with VADER + emoji signals only.")
    else:
        print("[INFO] ENABLE_HF_TRANSFORMERS=false; running lightweight mode.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Boot warmup
    load_models()
    yield

app = FastAPI(title="Social Pulse NLP Service", version="1.0.0", lifespan=lifespan)

# ─── Language & Script Detection ─────────────────────────────────────────────

DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
HINGLISH_WORDS = {
    "yaar", "bhai", "mast", "ekdum", "badhiya", "badiya", "achha", "acha",
    "bohot", "bahut", "sahi", "bilkul", "nahi", "nahin", "kya", "kaise", "kyun",
    "wala", "wali", "wale", "hoga", "hogi", "karo", "dekho", "samajh", "shandar",
    "zabardast", "ghatiya", "bakwas", "bekaar", "bekar", "faltu", "tha", "thi",
}

def detect_lang(text: str) -> Dict[str, str]:
    if DEVANAGARI_RE.search(text):
        return {"script": "Devanagari", "detected": "hi"}
    tokens = [t.lower() for t in re.split(r"\W+", text) if t]
    hinglish_count = sum(1 for t in tokens if t in HINGLISH_WORDS)
    if hinglish_count >= 2 or (hinglish_count >= 1 and len(tokens) <= 8):
        return {"script": "Latin", "detected": "hinglish"}
    return {"script": "Latin", "detected": "en"}

# ─── Emoji Scoring ───────────────────────────────────────────────────────────

EMOJI_WEIGHTS = {
    "🔥": 1.8, "❤️": 2.0, "😍": 2.0, "🥰": 1.9, "😊": 1.5, "😄": 1.5,
    "👍": 1.6, "👏": 1.6, "🙌": 1.6, "💯": 2.0, "🎉": 1.8, "✨": 1.5,
    "👎": -2.0, "😡": -2.2, "🤬": -2.5, "😤": -1.6, "😒": -1.8, "🙄": -2.0,
    "😞": -1.7, "😢": -1.9, "😭": -1.8, "🤮": -2.4, "💔": -2.2,
}

def analyze_emojis(text: str) -> Dict[str, Any]:
    emojis_found = [c for c in text if c in emoji.EMOJI_DATA]
    score = sum(EMOJI_WEIGHTS.get(e, 0.0) for e in emojis_found)
    return {"score": round(score, 2), "emojis": emojis_found}

# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "modelsLoaded": models_loaded,
        "availablePipelines": list(transformer_pipelines.keys()),
        "device": "cpu",
        "version": "1.0.0",
    }

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_comments(req: AnalyzeRequest):
    results = []

    for item in req.items:
        text = item.text.strip()
        lang_info = detect_lang(text)
        emoji_info = analyze_emojis(text)
        vader_res = vader_analyzer.polarity_scores(text)
        compound = vader_res["compound"]

        hf_sentiment = None
        hf_irony = None
        hf_emotion = None
        is_sarcastic = False

        # HF Transformers inference if available
        if "sentiment" in transformer_pipelines and lang_info["detected"] == "en":
            try:
                preds = transformer_pipelines["sentiment"](text[:512])
                if preds and isinstance(preds[0], list):
                    top = max(preds[0], key=lambda x: x["score"])
                    hf_sentiment = {"label": top["label"].lower(), "score": round(top["score"], 3)}
            except Exception:
                pass

        if "multilingual" in transformer_pipelines and lang_info["detected"] in ("hi", "hinglish"):
            try:
                preds = transformer_pipelines["multilingual"](text[:512])
                if preds and isinstance(preds[0], list):
                    top = max(preds[0], key=lambda x: x["score"])
                    hf_sentiment = {"label": top["label"].lower(), "score": round(top["score"], 3)}
            except Exception:
                pass

        if "irony" in transformer_pipelines:
            try:
                irony_pred = transformer_pipelines["irony"](text[:512])
                if irony_pred:
                    label = irony_pred[0]["label"].lower()
                    score = irony_pred[0]["score"]
                    is_ironic = label == "irony" and score > 0.65
                    hf_irony = {"score": round(score, 3)}
                    if is_ironic:
                        is_sarcastic = True
            except Exception:
                pass

        if "emotion" in transformer_pipelines:
            try:
                emo_preds = transformer_pipelines["emotion"](text[:512])
                if emo_preds and isinstance(emo_preds[0], list):
                    top = max(emo_preds[0], key=lambda x: x["score"])
                    hf_emotion = {"label": top["label"].lower(), "score": round(top["score"], 3)}
            except Exception:
                pass

        # Emotion mapping
        emotion = "none"
        if hf_emotion and hf_emotion["score"] > 0.4:
            emotion = hf_emotion["label"]
        elif compound > 0.35:
            emotion = "joy"
        elif compound < -0.35:
            emotion = "anger"

        # Final score calibration
        final_score = compound
        if emoji_info["score"] != 0:
            final_score = (compound * 0.7) + (max(-1.0, min(1.0, emoji_info["score"] / 3.0)) * 0.3)

        if is_sarcastic and final_score > 0:
            final_score = -final_score * 0.75

        # Sentiment label
        if final_score > 0.15:
            sentiment = "positive"
        elif final_score < -0.15:
            sentiment = "negative"
        else:
            sentiment = "neutral"

        is_mixed = (vader_res["pos"] > 0.1 and vader_res["neg"] > 0.1)
        confidence = min(0.95, max(0.4, abs(final_score) * 0.6 + 0.35))

        signals = SignalModel(
            vader={"compound": compound},
            hfSentiment=hf_sentiment,
            hfIrony=hf_irony,
            hfEmotion=hf_emotion,
            emoji=emoji_info,
            lang=lang_info,
        )

        results.append(
            ItemResult(
                id=item.id,
                sentiment=sentiment,
                score=round(final_score, 2),
                confidence=round(confidence, 2),
                emotion=emotion,
                language=lang_info["detected"],
                isSarcastic=is_sarcastic,
                isMixed=is_mixed,
                signals=signals,
            )
        )

    return AnalyzeResponse(results=results)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

