#!/usr/bin/env python3
"""Renew a failed Pages certificate with the GitHub Actions token."""
import json
import os
import socket
import subprocess
import time
import urllib.request
from datetime import date, datetime, timezone


def github_api(repository, method, payload=None):
    command = ["gh", "api", "--method", method, f"repos/{repository}/pages"]
    if payload is not None:
        command.extend(["--input", "-"])
    result = subprocess.run(
        command, input=json.dumps(payload) if payload is not None else None,
        text=True, capture_output=True, timeout=45,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return json.loads(result.stdout) if result.stdout.strip() else {}


def certificate_is_current(certificate):
    if not certificate or certificate.get("state") != "approved":
        return False
    try:
        expires = date.fromisoformat(certificate.get("expires_at", "").split("T")[0])
    except (TypeError, ValueError, AttributeError):
        return False
    return expires > datetime.now(timezone.utc).date()


def reset_domain(repository, domain):
    """Restore the original binding even if the reset fails partway through."""
    try:
        github_api(repository, "PUT", {"cname": None})
        github_api(repository, "PUT", {"cname": domain})
    except Exception:
        print("Checking the original domain binding after the failed reset.", flush=True)
        try:
            current = github_api(repository, "GET").get("cname")
        except Exception:
            # A failed read leaves the mutation's outcome uncertain. Restore the
            # exact original binding rather than leaving the domain detached.
            github_api(repository, "PUT", {"cname": domain})
        else:
            if current is None:
                github_api(repository, "PUT", {"cname": domain})
            elif current != domain:
                raise RuntimeError("Another operator changed the domain; preserving their binding.")
        raise


def verify_site(domain):
    for host in (domain, f"www.{domain}"):
        url = f"https://{host}/"
        # urllib's default TLS context verifies the certificate and hostname.
        with urllib.request.urlopen(url, timeout=20) as response:
            body = response.read().decode("utf-8", errors="replace")
            if response.status != 200 or "Sonne Systems" not in body or "<html" not in body.lower():
                raise RuntimeError(f"The expected website did not load at {url}")
            print(f"Verified HTTPS and website content: {url} (HTTP 200)", flush=True)


def renew_certificate(repository, domain, timeout_seconds=900, poll_seconds=20):
    site = github_api(repository, "GET")
    if site.get("cname") != domain:
        raise RuntimeError("The configured custom domain differs from the requested domain.")
    if not certificate_is_current(site.get("https_certificate")):
        print(f"Restarting certificate provisioning for {domain}.", flush=True)
        reset_domain(repository, domain)

    deadline = time.monotonic() + timeout_seconds
    last_status = None
    while time.monotonic() < deadline:
        site = github_api(repository, "GET")
        if site.get("cname") != domain:
            raise RuntimeError("The domain binding changed during renewal.")
        certificate = site.get("https_certificate") or {}
        status = (certificate.get("state"), certificate.get("expires_at"), certificate.get("description"))
        if status != last_status:
            print(f"Certificate state: {status}", flush=True)
            last_status = status
        if certificate_is_current(certificate):
            try:
                verify_site(domain)
            except OSError as error:
                print(f"Waiting for the renewed certificate to reach the serving endpoints: {error}", flush=True)
            else:
                if not site.get("https_enforced"):
                    github_api(repository, "PUT", {"https_enforced": True})
                print(f"Certificate renewed; expires {certificate['expires_at']}. HTTPS is enforced.", flush=True)
                return certificate
        time.sleep(poll_seconds)
    raise RuntimeError(f"Certificate provisioning did not complete: {last_status}")


if __name__ == "__main__":
    repository = os.environ.get("GITHUB_REPOSITORY", "9aman-og/sonnesystems")
    domain = os.environ.get("SONNE_PAGES_DOMAIN", "sonnesystems.com")
    if not os.environ.get("GH_TOKEN"):
        raise RuntimeError("A GitHub token with Pages write permission is required.")
    for host in (domain, f"www.{domain}"):
        try:
            addresses = sorted({entry[4][0] for entry in socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)})
            print(f"Public DNS for {host}: {addresses}", flush=True)
        except OSError as error:
            print(f"DNS lookup failed for {host}: {error}", flush=True)
    renew_certificate(repository, domain)
