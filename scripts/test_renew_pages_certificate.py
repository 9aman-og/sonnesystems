"""Check that certificate repair cannot silently leave the domain detached."""
import unittest
from unittest.mock import patch

import renew_pages_certificate as renewal


class CertificateRenewalTests(unittest.TestCase):
    def test_failed_reattachment_restores_original_domain(self):
        binding = {"cname": "sonnesystems.com"}
        restoration_attempts = 0

        def api(repository, method, payload=None):
            nonlocal restoration_attempts
            if method == "GET":
                return dict(binding)
            if payload["cname"] is None:
                binding["cname"] = None
            else:
                restoration_attempts += 1
                if restoration_attempts == 1:
                    raise RuntimeError("Transient reattachment failure")
                binding["cname"] = payload["cname"]
            return {}

        with patch.object(renewal, "github_api", side_effect=api):
            with self.assertRaisesRegex(RuntimeError, "Transient reattachment failure"):
                renewal.reset_domain("9aman-og/sonnesystems", "sonnesystems.com")
        self.assertEqual(binding["cname"], "sonnesystems.com")

    def test_permission_denial_preserves_existing_binding(self):
        def api(repository, method, payload=None):
            if method == "GET":
                return {"cname": "sonnesystems.com"}
            raise RuntimeError("Pages write permission denied")

        with patch.object(renewal, "github_api", side_effect=api) as calls:
            with self.assertRaisesRegex(RuntimeError, "permission denied"):
                renewal.reset_domain("9aman-og/sonnesystems", "sonnesystems.com")
        writes = [call for call in calls.call_args_list if call.args[1] == "PUT"]
        self.assertEqual(len(writes), 1)

    def test_conflicting_operator_binding_is_preserved(self):
        def api(repository, method, payload=None):
            if method == "GET":
                return {"cname": "changed.example.com"}
            raise RuntimeError("Request failed")

        with patch.object(renewal, "github_api", side_effect=api) as calls:
            with self.assertRaisesRegex(RuntimeError, "preserving their binding"):
                renewal.reset_domain("9aman-og/sonnesystems", "sonnesystems.com")
        self.assertEqual(len([call for call in calls.call_args_list if call.args[1] == "PUT"]), 1)

    def test_expired_approved_certificate_needs_renewal(self):
        self.assertFalse(renewal.certificate_is_current({"state": "approved", "expires_at": "2000-01-01"}))
        self.assertTrue(renewal.certificate_is_current({"state": "approved", "expires_at": "9999-01-01"}))

    def test_current_certificate_is_verified_without_domain_reset(self):
        certificate = {"state": "approved", "expires_at": "9999-01-01"}
        site = {"cname": "sonnesystems.com", "https_certificate": certificate, "https_enforced": False}
        with patch.object(renewal, "github_api", return_value=site) as api, \
                patch.object(renewal, "reset_domain") as reset, \
                patch.object(renewal, "verify_site") as verify:
            renewal.renew_certificate("9aman-og/sonnesystems", "sonnesystems.com")
        reset.assert_not_called()
        verify.assert_called_once_with("sonnesystems.com")
        api.assert_any_call("9aman-og/sonnesystems", "PUT", {"https_enforced": True})


if __name__ == "__main__":
    unittest.main()
