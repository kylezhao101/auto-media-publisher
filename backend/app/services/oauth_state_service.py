import os

from itsdangerous import BadSignature, URLSafeSerializer

from app.config import OAUTH_STATE_SECRET

serializer = URLSafeSerializer(
    OAUTH_STATE_SECRET,
    salt="youtube-oauth",
)


def create_oauth_state(
    organization_id: str,
    user_id: str,
    code_verifier: str,
) -> str:
    return serializer.dumps(
        {
            "organization_id": organization_id,
            "user_id": user_id,
            "code_verifier": code_verifier,
        }
    )


def decode_oauth_state(state: str) -> dict:
    try:
        return serializer.loads(state)
    except BadSignature:
        raise ValueError("Invalid OAuth state")
