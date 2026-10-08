import io
import json
import os
import tempfile
import subprocess
import sys
from pathlib import Path
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

from token_broker import TokenBroker
from google.oauth2.credentials import Credentials


class TokenRefreshTests(unittest.TestCase):
    def test_real_pipe_supports_initial_job_and_repeated_token_responses(self):
        script = (
            "import sys, json; from token_broker import TokenBroker; "
            "job=json.loads(sys.stdin.readline()); broker=TokenBroker(); "
            "broker.refresh(); broker.refresh(); print(json.dumps({'stage':'done'}), flush=True)"
        )
        child = subprocess.Popen([sys.executable, "-c", script], cwd=Path(__file__).parent,
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            child.stdin.write('{"mode":"upload-existing"}\n')
            child.stdin.flush()
            for token in ("first", "second"):
                request = json.loads(child.stdout.readline())
                self.assertEqual(request["type"], "token-request")
                child.stdin.write(json.dumps({"type": "token-response", "request_id": request["request_id"],
                                             "access_token": token, "expires_at": "2099-01-01T00:00:00"}) + "\n")
                child.stdin.flush()
            self.assertEqual(json.loads(child.stdout.readline())["stage"], "done")
            self.assertEqual(child.wait(timeout=5), 0)
        finally:
            if child.poll() is None:
                child.kill()
                child.wait()
            child.stdin.close()
            child.stdout.close()
            child.stderr.close()
    def broker(self, response=None, timeout=0.01):
        output = io.StringIO()
        with patch("token_broker.threading.Thread.start"):
            broker = TokenBroker(io.StringIO(), output, timeout)
        if response is not None:
            broker.responses.put(response)
        return broker, output

    def test_response_uses_matching_request_and_normalizes_expiry(self):
        broker, output = self.broker({"type": "token-response", "request_id": "request",
                                     "access_token": "fresh", "expires_at": "2099-01-01T01:00:00+01:00"})
        with patch("token_broker.uuid.uuid4", return_value="request"):
            token, expiry = broker.refresh()
        self.assertEqual(token, "fresh")
        self.assertEqual(expiry, datetime(2099, 1, 1))
        self.assertEqual(json.loads(output.getvalue())["type"], "token-request")

    def test_timeout_and_closed_pipe_are_actionable(self):
        broker, _ = self.broker()
        with self.assertRaisesRegex(RuntimeError, "timed out"):
            broker.refresh()
        broker.responses.put(None)
        with self.assertRaisesRegex(RuntimeError, "connection closed"):
            broker.refresh()

    def test_permission_failure_preserves_retry_guidance(self):
        broker, _ = self.broker({"type": "token-response", "request_id": "request", "error": "Publishing permission removed"})
        with patch("token_broker.uuid.uuid4", return_value="request"):
            with self.assertRaisesRegex(RuntimeError, "Your render is saved"):
                broker.refresh()

    def test_expiry_causes_renewal_on_same_credentials(self):
        provider = Mock(side_effect=[
            ("first", datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)),
            ("second", datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)),
        ])
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"AMP_APP_DATA_DIR": directory}):
            import youtube
            with patch.object(youtube, "build", side_effect=lambda *args, **kwargs: kwargs["credentials"]):
                creds = youtube.get_youtube_client({"type": "organization"}, token_provider=provider)
        creds.expiry = datetime(2000, 1, 1)
        headers = {}
        creds.before_request(Mock(), "POST", "https://www.googleapis.com/upload", headers)
        self.assertEqual(headers["authorization"], "Bearer second")
        self.assertEqual(provider.call_count, 2)

    def test_personal_credentials_still_use_local_refresh(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"AMP_APP_DATA_DIR": directory}):
            import youtube
            token_path = Path(directory) / "google-token.json"
            token_path.write_text("{}")
            creds = Mock(expired=True, refresh_token="local-refresh", valid=True)
            creds.to_json.return_value = '{"token":"renewed-local"}'
            with patch.object(youtube, "GOOGLE_TOKEN_PATH", token_path), \
                    patch.object(youtube.Credentials, "from_authorized_user_info", return_value=creds), \
                    patch.object(youtube, "build", return_value="client"):
                self.assertEqual(youtube.get_youtube_client({"type": "local"}), "client")
            creds.refresh.assert_called_once()
            self.assertEqual(json.loads(token_path.read_text())["token"], "renewed-local")

    def test_render_finishes_before_organization_token_is_requested(self):
        # Import worker with application data confined to the test directory.
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"AMP_APP_DATA_DIR": directory}):
            import worker
            calls = []
            job = {"mode": "render-and-upload", "clips": ["clip.mp4"], "title": "test",
                   "output_path": directory + "/render.mp4", "encoder": "cpu",
                   "youtube_auth": {"type": "organization"}}
            provider = Mock(return_value=("fresh", datetime(2099, 1, 1)))
            def upload(*args, **kwargs):
                self.assertEqual(calls, ["rendered"])
                kwargs["token_provider"]()
                return "video"
            with patch.object(worker.sys, "stdin", io.StringIO(json.dumps(job) + "\n")), \
                    patch.object(worker, "logger", Mock()), \
                    patch.object(worker, "emit"), \
                    patch.object(worker, "render", side_effect=lambda *args, **kwargs: calls.append("rendered")), \
                    patch.object(worker, "TokenBroker", return_value=Mock(refresh=provider)), \
                    patch.object(worker, "upload_video", side_effect=upload):
                worker.main()
            provider.assert_called_once()
            # Close import-time logger's file before TemporaryDirectory cleanup on Windows.
            for handler in worker.setup_logger().handlers[:]:
                handler.close()
                worker.setup_logger().removeHandler(handler)


if __name__ == "__main__":
    unittest.main()
