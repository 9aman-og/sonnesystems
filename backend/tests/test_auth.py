EMAIL = "founder@sonnesystems.com"
PW = "correct-horse-battery"


def _register(client, email=EMAIL, pw=PW):
    return client.post("/auth/register", json={"email": email, "password": pw})


def test_register_login_me_logout_flow(client):
    r = _register(client)
    assert r.status_code == 201
    assert r.json()["email"] == EMAIL

    r = client.post("/auth/login", json={"email": EMAIL, "password": PW})
    assert r.status_code == 200
    token = r.json()["token"]
    assert len(token) > 30

    headers = {"Authorization": f"Bearer {token}"}
    r = client.get("/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == EMAIL

    assert client.post("/auth/logout", headers=headers).status_code == 204
    # token is revoked afterwards
    assert client.get("/auth/me", headers=headers).status_code == 401


def test_duplicate_email_is_409(client):
    _register(client, email="dup@example.com")
    assert _register(client, email="dup@example.com").status_code == 409


def test_wrong_password_is_401_and_generic(client):
    _register(client, email="who@example.com")
    r = client.post("/auth/login", json={"email": "who@example.com", "password": "wrong-password"})
    assert r.status_code == 401
    # same error whether the email exists or not
    r2 = client.post("/auth/login", json={"email": "ghost@example.com", "password": "whatever-pw"})
    assert r2.status_code == 401
    assert r.json()["detail"] == r2.json()["detail"]


def test_me_requires_token(client):
    assert client.get("/auth/me").status_code == 401


def test_short_password_rejected(client):
    r = client.post("/auth/register", json={"email": "short@example.com", "password": "tiny"})
    assert r.status_code == 422


def test_email_is_normalized(client):
    r = _register(client, email="  MiXeD@Example.COM  ")
    assert r.status_code == 201
    assert r.json()["email"] == "mixed@example.com"
