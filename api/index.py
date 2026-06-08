from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from mangum import Mangum
import os
import logging
import uuid
import requests

# Load .env for local development (Vercel injects env vars automatically)
try:
    from dotenv import load_dotenv
    from pathlib import Path
    load_dotenv(Path(__file__).parent.parent / "backend" / ".env")
except Exception:
    pass

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# ── MongoDB ──────────────────────────────────────────────────────────────────
# Set MONGO_URL and DB_NAME in Vercel project environment variables.
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "payment_tracker")

_mongo_client: Optional[MongoClient] = None


def get_db():
    """Return a MongoDB database handle, reusing the client across warm invocations."""
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(
            MONGO_URL,
            serverSelectionTimeoutMS=5000,
            tls=True,
            tlsAllowInvalidCertificates=True,
        )
    return _mongo_client[DB_NAME]


# ── Vercel Blob storage ───────────────────────────────────────────────────────
# Vercel auto-injects BLOB_READ_WRITE_TOKEN when you link a Blob store to your project.
BLOB_READ_WRITE_TOKEN = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
BLOB_API_URL = "https://blob.vercel-storage.com"

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
MIME_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
}


def upload_to_blob(filename: str, data: bytes, content_type: str) -> str:
    """Upload bytes to Vercel Blob and return the public URL."""
    if not BLOB_READ_WRITE_TOKEN:
        raise HTTPException(
            status_code=500,
            detail="BLOB_READ_WRITE_TOKEN is not set — configure it in your Vercel project settings.",
        )
    resp = requests.put(
        f"{BLOB_API_URL}/{filename}",
        data=data,
        headers={
            "Authorization": f"Bearer {BLOB_READ_WRITE_TOKEN}",
            "x-api-version": "7",
            "content-type": content_type,
            "x-add-random-suffix": "1",  # prevent filename collisions
        },
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["url"]


def delete_from_blob(url: str) -> None:
    """Delete a file from Vercel Blob by its public URL. Silently skips non-blob URLs."""
    if not BLOB_READ_WRITE_TOKEN or not url:
        return
    if not (url.startswith("http://") or url.startswith("https://")):
        return  # legacy Emergent path — nothing to delete from Blob
    try:
        resp = requests.delete(
            BLOB_API_URL,
            headers={
                "Authorization": f"Bearer {BLOB_READ_WRITE_TOKEN}",
                "x-api-version": "7",
            },
            json={"urls": [url]},
            timeout=30,
        )
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"Blob delete failed for {url}: {e}")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="Failed Payment Tracker API")
api_router = APIRouter(prefix="/api")


# ── Pydantic models ───────────────────────────────────────────────────────────
class PaymentBase(BaseModel):
    amount: float
    payment_date: str  # YYYY-MM-DD
    merchant: str
    payment_method: str  # UPI / Card / NetBanking / Wallet / Other
    transaction_id: Optional[str] = ""
    bank_name: Optional[str] = ""
    status: str = "Pending"  # Pending / Failed / Refunded / Lost
    notes: Optional[str] = ""
    screenshot_path: Optional[str] = None   # Vercel Blob public URL (or None)
    screenshot_filename: Optional[str] = None


class PaymentCreate(PaymentBase):
    pass


class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    payment_date: Optional[str] = None
    merchant: Optional[str] = None
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    bank_name: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    screenshot_path: Optional[str] = None
    screenshot_filename: Optional[str] = None


class Payment(PaymentBase):
    id: str
    created_at: str
    updated_at: str


def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ── Routes ────────────────────────────────────────────────────────────────────
@api_router.get("/")
def root():
    return {"message": "Failed Payment Tracker API"}


@api_router.post("/payments", response_model=Payment)
def create_payment(payload: PaymentCreate):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now
    doc["updated_at"] = now
    db.payments.insert_one(doc)
    return Payment(**_serialize(doc))


@api_router.get("/payments", response_model=List[Payment])
def list_payments(status: Optional[str] = None, search: Optional[str] = None):
    db = get_db()
    query: dict = {}
    if status and status != "All":
        query["status"] = status
    if search:
        query["$or"] = [
            {"merchant": {"$regex": search, "$options": "i"}},
            {"transaction_id": {"$regex": search, "$options": "i"}},
            {"bank_name": {"$regex": search, "$options": "i"}},
        ]
    docs = list(db.payments.find(query, {"_id": 0}).sort("payment_date", -1).limit(1000))
    return [Payment(**d) for d in docs]


@api_router.get("/payments/stats")
def get_stats():
    db = get_db()
    pipeline = [
        {"$group": {"_id": "$status", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    total_stuck = 0.0
    pending_count = 0
    recovered = 0.0
    lost = 0.0
    total_records = 0
    for row in db.payments.aggregate(pipeline):
        st = row.get("_id") or "Pending"
        total = float(row.get("total") or 0)
        cnt = int(row.get("count") or 0)
        total_records += cnt
        if st == "Pending":
            total_stuck += total
            pending_count += cnt
        elif st == "Refunded":
            recovered += total
        elif st == "Lost":
            lost += total
    return {
        "total_stuck": round(total_stuck, 2),
        "pending_count": pending_count,
        "recovered_amount": round(recovered, 2),
        "lost_amount": round(lost, 2),
        "total_records": total_records,
    }


@api_router.get("/payments/{payment_id}", response_model=Payment)
def get_payment(payment_id: str):
    db = get_db()
    doc = db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Payment not found")
    return Payment(**doc)


@api_router.patch("/payments/{payment_id}", response_model=Payment)
def update_payment(payment_id: str, payload: PaymentUpdate):
    db = get_db()
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = db.payments.update_one({"id": payment_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    doc = db.payments.find_one({"id": payment_id}, {"_id": 0})
    return Payment(**doc)


@api_router.delete("/payments/{payment_id}")
def delete_payment(payment_id: str):
    db = get_db()
    doc = db.payments.find_one({"id": payment_id}, {"_id": 0, "screenshot_path": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Payment not found")
    # Delete the screenshot from Vercel Blob before removing the record
    if doc.get("screenshot_path"):
        delete_from_blob(doc["screenshot_path"])
    db.payments.delete_one({"id": payment_id})
    return {"ok": True}


@api_router.get("/cron/cleanup-screenshots")
def cron_cleanup_screenshots(authorization: Optional[str] = Header(None)):
    """
    Monthly cron job: delete screenshots for all Refunded/Lost payments.
    Vercel automatically calls this with Authorization: Bearer {CRON_SECRET}.
    Pending/Failed payments keep their screenshots as active evidence.
    """
    cron_secret = os.environ.get("CRON_SECRET", "")
    if not authorization or authorization != f"Bearer {cron_secret}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    db = get_db()
    resolved_statuses = ["Refunded", "Lost"]
    candidates = list(db.payments.find(
        {
            "status": {"$in": resolved_statuses},
            "screenshot_path": {"$ne": None, "$exists": True},
        },
        {"_id": 0, "id": 1, "screenshot_path": 1},
    ))

    deleted = 0
    failed = 0
    now = datetime.now(timezone.utc).isoformat()

    for doc in candidates:
        try:
            delete_from_blob(doc["screenshot_path"])
            db.payments.update_one(
                {"id": doc["id"]},
                {"$set": {
                    "screenshot_path": None,
                    "screenshot_filename": None,
                    "updated_at": now,
                }},
            )
            deleted += 1
        except Exception as e:
            logger.error(f"Cleanup failed for payment {doc['id']}: {e}")
            failed += 1

    logger.info(f"Screenshot cleanup: {deleted} deleted, {failed} failed")
    return {"ok": True, "deleted": deleted, "failed": failed}


@api_router.post("/screenshots")
async def upload_screenshot(file: UploadFile = File(...)):
    """Upload a screenshot to Vercel Blob and return its public URL."""
    ext = "bin"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed (jpg, png, gif, webp)",
        )
    content_type = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")
    blob_filename = f"screenshots/{uuid.uuid4()}.{ext}"
    try:
        public_url = upload_to_blob(blob_filename, data, content_type)
        return {
            "storage_path": public_url,          # Direct public Vercel Blob URL
            "filename": file.filename or f"screenshot.{ext}",
            "content_type": content_type,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Screenshot upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# ── Middleware ────────────────────────────────────────────────────────────────
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Vercel serverless entry point ─────────────────────────────────────────────
# Vercel calls `handler` for every request routed to this function.
handler = Mangum(app, lifespan="off")
