"""Quick end-to-end smoke test of the API wiring (no real Apify/Gemini calls)."""
import os
import tempfile

from cryptography.fernet import Fernet

# Set required env BEFORE importing the app (load_dotenv won't override these).
os.environ["MASTER_ENCRYPTION_KEY"] = Fernet.generate_key().decode()
os.environ["JWT_SECRET"] = "test-secret-not-for-production"
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.gettempdir(), 'smoke.db')}"
# fresh db each run
_dbf = os.path.join(tempfile.gettempdir(), "smoke.db")
for ext in ("", "-wal", "-shm"):
    try:
        os.remove(_dbf + ext)
    except OSError:
        pass

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

with TestClient(app) as c:
    # health
    assert c.get("/health").json() == {"status": "ok"}, "health failed"

    # signup
    r = c.post("/auth/signup", json={"email": "a@b.com", "password": "password123"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    assert r.json()["onboarded"] is False
    h = {"Authorization": f"Bearer {token}"}

    # duplicate signup -> 409
    assert c.post("/auth/signup", json={"email": "a@b.com", "password": "password123"}).status_code == 409

    # login
    r = c.post("/auth/login", json={"email": "a@b.com", "password": "password123"})
    assert r.status_code == 200, r.text

    # wrong password
    assert c.post("/auth/login", json={"email": "a@b.com", "password": "nope"}).status_code == 401

    # me
    assert c.get("/auth/me", headers=h).json()["email"] == "a@b.com"

    # unauthenticated settings -> 401
    assert c.get("/settings").status_code == 401

    # default settings
    r = c.get("/settings", headers=h)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["timezone"] == "Asia/Kolkata"
    assert s["relevance_threshold"] == 7
    assert s["keys"]["apify_set"] is False

    # update settings (schedule + tuning + profile text)
    r = c.put("/settings", headers=h, json={
        "schedule_hour": 9, "schedule_minute": 30, "timezone": "Asia/Kolkata",
        "relevance_threshold": 8, "profile_text": "I build AI products.",
        "enabled": True,
    })
    assert r.status_code == 200, r.text
    assert r.json()["schedule_hour"] == 9 and r.json()["enabled"] is True

    # bad timezone rejected
    assert c.put("/settings", headers=h, json={"timezone": "Mars/Phobos"}).status_code == 422

    # keys round-trip (stored encrypted, never returned)
    r = c.put("/settings/keys", headers=h, json={
        "apify_key": "apk_test", "gemini_key": "gem_test",
        "telegram_bot_token": "123:abc", "telegram_chat_id": "555",
    })
    assert r.status_code == 200, r.text
    ks = r.json()["keys"]
    assert ks["apify_set"] and ks["gemini_set"] and ks["telegram_bot_set"] and ks["telegram_chat_set"]
    # onboarded should flip true now that all 4 keys are present
    assert c.get("/auth/me", headers=h).json()["onboarded"] is True
    # ensure no plaintext key leaks in the settings payload
    assert "apk_test" not in r.text and "gem_test" not in r.text

    # profiles
    r = c.post("/profiles", headers=h, json={"url": "linkedin.com/in/andrewyng"})
    assert r.status_code == 201, r.text
    assert r.json()["url"] == "https://linkedin.com/in/andrewyng/"
    # non-linkedin url rejected
    assert c.post("/profiles", headers=h, json={"url": "https://twitter.com/x"}).status_code == 422
    # bulk add (one valid, one junk)
    r = c.post("/profiles/bulk", headers=h, json={"urls": [
        "https://www.linkedin.com/in/kunal-kushwaha/", "not-a-url",
    ]})
    assert r.status_code == 200, r.text
    profiles = c.get("/profiles", headers=h).json()
    assert len(profiles) == 2, profiles
    # delete one
    assert c.delete(f"/profiles/{profiles[0]['id']}", headers=h).status_code == 200
    assert len(c.get("/profiles", headers=h).json()) == 1

    # runs history empty
    assert c.get("/runs", headers=h).json() == []

    # next run should be scheduled (we enabled the user)
    nr = c.get("/runs/next", headers=h).json()
    assert nr["next_run_at"] is not None, "scheduler did not register the job"

    # crypto verification: stored value is encrypted, decrypts back
    from app import crypto
    from app.database import SessionLocal
    from app import models
    db = SessionLocal()
    st = db.get(models.UserSettings, 1)
    assert st.apify_key_enc and st.apify_key_enc != "apk_test"
    assert crypto.decrypt(st.apify_key_enc) == "apk_test"
    db.close()

print("ALL SMOKE TESTS PASSED")
