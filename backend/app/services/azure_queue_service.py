import json
from typing import Optional

from azure.storage.queue import QueueClient

from app.config import AZURE_CONNECTION_STRING, AZURE_QUEUE_NAME

class AzureQueueService:
    def __init__(self) -> None:
        self.client: Optional[QueueClient] = None
        self.configuration_error: Optional[str] = None

        if not AZURE_CONNECTION_STRING:
            self.configuration_error = "Azure connection string is not set"
            return

        try:
            self.client = QueueClient.from_connection_string(
                conn_str=AZURE_CONNECTION_STRING,
                queue_name=AZURE_QUEUE_NAME,
            )
        except ValueError as exc:
            self.configuration_error = str(exc)

    @property
    def is_available(self) -> bool:
        print(self.client)
        return self.client is not None

    def ensure_queue_exists(self) -> None:
        if not self.client:
            return
        try:
            self.client.create_queue()
        except Exception as e:
            print(f"Error creating queue: {e}")
        
    def enqueue_message_as_json(self, message: dict) -> None:
        if not self.client:
            raise RuntimeError(self.configuration_error or "Azure queue client is not configured")
        try:
            self.client.send_message(json.dumps(message))
        except Exception as e:
            print(f"Error enqueuing message: {e}")