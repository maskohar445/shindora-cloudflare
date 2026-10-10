import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:3000").rstrip("/")


def test_public_api_payloads():
    assert BASE_URL
    session = requests.Session()
    for endpoint in ("/api/videos", "/api/categories", "/api/settings"):
        response = session.get(BASE_URL + endpoint, timeout=20)
        assert response.status_code == 200, (endpoint, response.text[:500])
        assert response.headers.get("content-type", "").startswith("application/json")
        payload = response.json()
        assert payload is not None
        if endpoint == "/api/videos":
            videos = payload.get("videos", payload) if isinstance(payload, dict) else payload
            assert isinstance(videos, list)
            assert len(videos) >= 120
        elif endpoint == "/api/categories":
            categories = payload.get("categories", payload) if isinstance(payload, dict) else payload
            assert isinstance(categories, list)
            assert len(categories) > 0


def test_admin_login():
    assert BASE_URL
    response = requests.post(
        BASE_URL + "/api/auth/login",
        json={"email": "maskohar76@gmail.com", "password": "Emilia9@#$"},
        timeout=20,
    )
    assert response.status_code == 200, response.text[:500]
    payload = response.json()
    assert isinstance(payload, dict)
    assert payload.get("token") or payload.get("user")