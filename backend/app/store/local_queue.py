from __future__ import annotations
from typing import List, Optional, Dict, Any

QUEUE: List[Dict[str, Any]] = []

def enqueue(message: Dict[str, Any]) -> None:
    QUEUE.append(message)

def dequeue() -> Optional[Dict[str, Any]]:
    if QUEUE:
        return QUEUE.pop(0)
    return None