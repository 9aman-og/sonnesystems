def test_contact_message_stored(client):
    r = client.post("/contact", json={
        "name": "Ada",
        "email": "ada@example.com",
        "subject": "Paper access",
        "message": "May I read the ca-lif paper?",
    })
    assert r.status_code == 201
    assert r.json()["id"] >= 1


def test_contact_requires_message(client):
    r = client.post("/contact", json={"name": "Ada", "email": "ada@example.com"})
    assert r.status_code == 422


def test_contact_rejects_bad_email(client):
    r = client.post("/contact", json={"name": "X", "email": "not-an-email", "message": "hi"})
    assert r.status_code == 422


def test_newsletter_idempotent(client):
    first = client.post("/newsletter", json={"email": "reader@example.com"})
    assert first.status_code == 201
    again = client.post("/newsletter", json={"email": "reader@example.com"})
    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"]
