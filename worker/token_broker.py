"""Request short-lived Google credentials from the desktop over JSON lines."""
import json
import queue
import sys
import threading
import time
import uuid
from datetime import datetime, timezone


class TokenBroker:
    def __init__(self, input_stream=None, output_stream=None, timeout=35):
        self.input = input_stream or sys.stdin
        self.output = output_stream or sys.stdout
        self.timeout = timeout
        self.responses = queue.Queue()
        threading.Thread(target=self._read_responses, daemon=True).start()

    def _read_responses(self):
        try:
            for line in self.input:
                try:
                    self.responses.put(json.loads(line))
                except ValueError:
                    continue
        finally:
            self.responses.put(None)

    def refresh(self, request=None, scopes=None):
        request_id = str(uuid.uuid4())
        print(json.dumps({"type": "token-request", "request_id": request_id}),
              file=self.output, flush=True)
        deadline = time.monotonic() + self.timeout
        while True:
            try:
                response = self.responses.get(timeout=max(0, deadline - time.monotonic()))
            except queue.Empty:
                raise RuntimeError("YouTube authorization timed out. Your render is saved; retry the upload.") from None
            if response is None:
                raise RuntimeError("Desktop connection closed while authorizing YouTube.")
            if not isinstance(response, dict) or response.get("type") != "token-response" or response.get("request_id") != request_id:
                continue
            if response.get("error"):
                raise RuntimeError(f"YouTube authorization failed: {response['error']}. Your render is saved; retry the upload.")
            token = response.get("access_token")
            try:
                expiry = datetime.fromisoformat(response["expires_at"].replace("Z", "+00:00"))
            except (KeyError, ValueError, AttributeError, TypeError):
                raise RuntimeError("YouTube token expiry is missing or invalid.") from None
            # Backend emits UTC, sometimes without an explicit offset. google-auth
            # expects a naive UTC datetime when comparing credential expiry.
            if expiry.tzinfo is not None:
                expiry = expiry.astimezone(timezone.utc).replace(tzinfo=None)
            if not isinstance(token, str) or not token:
                raise RuntimeError("YouTube access token is missing.")
            return token, expiry
