"""Backend tests for Failed Payment Tracker - payments CRUD, stats and screenshot endpoints."""
import io
import os
import struct
import zlib

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://receipt-recovery.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# -------- helpers --------
def _make_png_bytes() -> bytes:
    """Minimal valid 1x1 PNG."""
    sig = b"\x89PNG\r\n\x1a\n"

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw = b"\x00\xff\x00\x00"
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    yield s
    s.close()


@pytest.fixture(scope="module")
def created_ids():
    """Track ids created during tests for cleanup."""
    ids = []
    yield ids
    # Cleanup at end
    for pid in ids:
        try:
            requests.delete(f"{API}/payments/{pid}", timeout=20)
        except Exception:
            pass


# -------- root --------
def test_root(session):
    r = session.get(f"{API}/", timeout=20)
    assert r.status_code == 200
    assert r.json().get("message") == "Failed Payment Tracker API"


# -------- payment CRUD --------
def test_create_payment_all_fields(session, created_ids):
    payload = {
        "amount": 1234.56,
        "payment_date": "2026-01-10",
        "merchant": "BESCOM Electricity",
        "payment_method": "UPI",
        "transaction_id": "TXN-TEST-001",
        "bank_name": "HDFC Bank",
        "status": "Pending",
        "notes": "TEST_ stuck payment",
    }
    r = session.post(f"{API}/payments", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["id"]
    assert data["amount"] == 1234.56
    assert data["merchant"] == "BESCOM Electricity"
    assert data["payment_method"] == "UPI"
    assert data["transaction_id"] == "TXN-TEST-001"
    assert data["bank_name"] == "HDFC Bank"
    assert data["status"] == "Pending"
    assert data["notes"] == "TEST_ stuck payment"
    assert data["created_at"]
    assert data["updated_at"]
    created_ids.append(data["id"])


def test_get_payment_persisted(session, created_ids):
    pid = created_ids[0]
    r = session.get(f"{API}/payments/{pid}", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["id"] == pid
    assert d["merchant"] == "BESCOM Electricity"
    assert d["transaction_id"] == "TXN-TEST-001"


def test_list_payments_contains_created(session, created_ids):
    r = session.get(f"{API}/payments", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    ids = [i["id"] for i in items]
    assert created_ids[0] in ids


def test_create_more_payments_diverse_status(session, created_ids):
    # Refunded
    p2 = {
        "amount": 500.0,
        "payment_date": "2026-01-08",
        "merchant": "Amazon",
        "payment_method": "Card",
        "transaction_id": "TXN-TEST-002",
        "bank_name": "ICICI Bank",
        "status": "Refunded",
        "notes": "TEST_",
    }
    r2 = session.post(f"{API}/payments", json=p2, timeout=30)
    assert r2.status_code == 200
    created_ids.append(r2.json()["id"])

    # Lost
    p3 = {
        "amount": 2000.0,
        "payment_date": "2026-01-05",
        "merchant": "Swiggy",
        "payment_method": "NetBanking",
        "transaction_id": "TXN-TEST-003",
        "bank_name": "Axis Bank",
        "status": "Lost",
        "notes": "TEST_",
    }
    r3 = session.post(f"{API}/payments", json=p3, timeout=30)
    assert r3.status_code == 200
    created_ids.append(r3.json()["id"])


def test_filter_by_status_pending(session, created_ids):
    r = session.get(f"{API}/payments", params={"status": "Pending"}, timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert all(i["status"] == "Pending" for i in items)
    assert created_ids[0] in [i["id"] for i in items]


def test_search_by_merchant_bescom(session, created_ids):
    r = session.get(f"{API}/payments", params={"search": "BESCOM"}, timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    assert any("BESCOM" in i["merchant"] for i in items)
    assert created_ids[0] in [i["id"] for i in items]


def test_search_by_transaction_id(session, created_ids):
    r = session.get(f"{API}/payments", params={"search": "TXN-TEST-002"}, timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    assert items[0]["transaction_id"] == "TXN-TEST-002"


def test_search_by_bank(session, created_ids):
    r = session.get(f"{API}/payments", params={"search": "Axis"}, timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert any("Axis" in (i.get("bank_name") or "") for i in items)


# -------- stats --------
def test_stats_aggregation(session, created_ids):
    r = session.get(f"{API}/payments/stats", timeout=20)
    assert r.status_code == 200
    s = r.json()
    for k in ("total_stuck", "pending_count", "recovered_amount", "lost_amount", "total_records"):
        assert k in s
    # Our 3 test records: Pending 1234.56, Refunded 500, Lost 2000
    assert s["pending_count"] >= 1
    assert s["total_stuck"] >= 1234.56
    assert s["recovered_amount"] >= 500.0
    assert s["lost_amount"] >= 2000.0
    assert s["total_records"] >= 3


# -------- update --------
def test_update_status_pending_to_refunded(session, created_ids):
    pid = created_ids[0]
    # before stats
    before = session.get(f"{API}/payments/stats", timeout=20).json()

    r = session.patch(f"{API}/payments/{pid}", json={"status": "Refunded"}, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "Refunded"

    # verify persistence via GET
    g = session.get(f"{API}/payments/{pid}", timeout=20).json()
    assert g["status"] == "Refunded"

    # stats should recalculate (this payment moved from pending->refunded)
    after = session.get(f"{API}/payments/stats", timeout=20).json()
    # pending_count should decrease by 1 OR total_stuck should decrease by 1234.56
    assert after["pending_count"] == before["pending_count"] - 1
    assert round(before["total_stuck"] - after["total_stuck"], 2) == 1234.56
    assert round(after["recovered_amount"] - before["recovered_amount"], 2) == 1234.56


def test_update_no_fields_returns_400(session, created_ids):
    pid = created_ids[0]
    r = session.patch(f"{API}/payments/{pid}", json={}, timeout=20)
    assert r.status_code == 400


def test_get_payment_404(session):
    r = session.get(f"{API}/payments/nonexistent-id-xyz", timeout=20)
    assert r.status_code == 404


def test_update_payment_404(session):
    r = session.patch(f"{API}/payments/nonexistent-id-xyz", json={"status": "Lost"}, timeout=20)
    assert r.status_code == 404


# -------- screenshot upload --------
def test_upload_screenshot_png(session):
    png_bytes = _make_png_bytes()
    files = {"file": ("test.png", io.BytesIO(png_bytes), "image/png")}
    r = session.post(f"{API}/screenshots", files=files, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "storage_path" in d
    assert d["filename"] == "test.png"
    assert d["content_type"] == "image/png"
    # store for next test
    pytest.shared_storage_path = d["storage_path"]


def test_upload_screenshot_rejects_non_image(session):
    files = {"file": ("test.txt", io.BytesIO(b"not an image"), "text/plain")}
    r = session.post(f"{API}/screenshots", files=files, timeout=30)
    assert r.status_code == 400
    assert "image" in r.json().get("detail", "").lower()


def test_download_screenshot(session):
    path = getattr(pytest, "shared_storage_path", None)
    if not path:
        pytest.skip("No uploaded screenshot to download")
    r = session.get(f"{API}/screenshots/{path}", timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/png")
    assert r.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_download_screenshot_404(session):
    r = session.get(f"{API}/screenshots/failed-payment-tracker/screenshots/no-such.png", timeout=30)
    assert r.status_code == 404


# -------- payment with screenshot link --------
def test_payment_with_screenshot_link(session, created_ids):
    path = getattr(pytest, "shared_storage_path", None)
    if not path:
        pytest.skip("No screenshot uploaded")
    payload = {
        "amount": 99.99,
        "payment_date": "2026-01-11",
        "merchant": "TEST_ Linked",
        "payment_method": "UPI",
        "transaction_id": "TXN-TEST-LINK",
        "bank_name": "Kotak",
        "status": "Pending",
        "notes": "linked screenshot",
        "screenshot_path": path,
        "screenshot_filename": "test.png",
    }
    r = session.post(f"{API}/payments", json=payload, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["screenshot_path"] == path
    assert d["screenshot_filename"] == "test.png"
    created_ids.append(d["id"])

    # GET to verify persisted
    g = session.get(f"{API}/payments/{d['id']}", timeout=20).json()
    assert g["screenshot_path"] == path


# -------- delete --------
def test_delete_payment_and_verify_404(session, created_ids):
    # Take last id, delete and confirm 404
    pid = created_ids[-1]
    r = session.delete(f"{API}/payments/{pid}", timeout=20)
    assert r.status_code == 200
    assert r.json().get("ok") is True

    g = session.get(f"{API}/payments/{pid}", timeout=20)
    assert g.status_code == 404
    created_ids.remove(pid)


def test_delete_payment_404(session):
    r = session.delete(f"{API}/payments/nonexistent-id-xyz", timeout=20)
    assert r.status_code == 404
