def test_security_headers_and_request_id(client):
    response = client.get("/health", headers={"X-Request-ID": "qa-request-01"})
    assert response.status_code == 200
    assert response.headers["x-request-id"] == "qa-request-01"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["content-security-policy"].startswith("default-src 'none'")
    assert response.headers["cross-origin-opener-policy"] == "same-origin"
    assert response.headers["cache-control"] == "no-store"


def test_untrusted_host_is_rejected(client):
    response = client.get("/health", headers={"Host": "attacker.invalid"})
    assert response.status_code == 400


def test_oversized_body_rejected_before_validation(client):
    response = client.post(
        "/contact",
        json={"name": "Ada", "email": "ada@example.com", "message": "x" * 70_000},
    )
    assert response.status_code == 413
    assert response.json()["detail"] == "Request body too large"


def test_json_routes_reject_form_content_types(client):
    response = client.post(
        "/contact",
        content="name=Ada&email=ada%40example.com&message=Hello",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 415
    assert response.json()["detail"] == "Content-Type must be application/json"


def test_cors_preflight_allows_only_configured_origins(client):
    allowed = client.options(
        "/contact",
        headers={
            "Origin": "https://sonnesystems.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "https://sonnesystems.com"

    rejected = client.options(
        "/contact",
        headers={
            "Origin": "https://attacker.invalid",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert rejected.status_code == 400
    assert "access-control-allow-origin" not in rejected.headers


def test_contact_rate_limit_has_retry_contract(client):
    payload = {"name": "Ada", "email": "ada@example.com", "message": "Hello"}
    for _ in range(5):
        assert client.post("/contact", json=payload).status_code == 201
    limited = client.post("/contact", json=payload)
    assert limited.status_code == 429
    assert int(limited.headers["retry-after"]) >= 1
    assert limited.headers["x-request-id"]


def test_contact_text_is_trimmed_and_controls_are_rejected(client):
    trimmed = client.post(
        "/contact",
        json={"name": "  Ada  ", "email": "ada@example.com", "message": "  Hello  "},
    )
    assert trimmed.status_code == 201
    invalid = client.post(
        "/contact",
        json={"name": "Ada\u0000", "email": "ada2@example.com", "message": "Hello"},
    )
    assert invalid.status_code == 422
