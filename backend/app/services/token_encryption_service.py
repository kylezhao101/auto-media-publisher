import os

from cryptography.fernet import Fernet
from app.config import YOUTUBE_TOKEN_ENCRYPTION_KEY

fernet = Fernet(YOUTUBE_TOKEN_ENCRYPTION_KEY.encode())


def encrypt_token(token: str) -> str:
    return fernet.encrypt(token.encode()).decode()


def decrypt_token(token: str) -> str:
    return fernet.decrypt(token.encode()).decode()
