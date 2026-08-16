import os
import resend

resend.api_key = os.environ["RESEND_API_KEY"]

EMAIL_FROM = os.environ["EMAIL_FROM"]


def send_organization_invitation_email(
    *,
    to: str,
    organization_name: str,
    invited_by: str | None,
    role: str,
    invite_url: str,
) -> None:
    inviter = invited_by or "An organization administrator"

    resend.Emails.send(
        {
            "from": EMAIL_FROM,
            "to": [to],
            "subject": f"You've been invited to join {organization_name}",
            "html": f"""
                <div style="
                    font-family: Arial, sans-serif;
                    max-width: 560px;
                    margin: 0 auto;
                ">
                    <h2>
                        Join {organization_name}
                    </h2>

                    <p>
                        You've been invited to join
                        <strong>{organization_name}</strong>
                        on Auto Media Publisher.
                    </p>

                    <p>
                        <strong>Invited by:</strong>
                        {inviter}
                        <br />
                        <strong>Role:</strong>
                        {role.capitalize()}
                    </p>

                    <p style="margin: 28px 0;">
                        <a
                            href="{invite_url}"
                            style="
                                display: inline-block;
                                padding: 10px 16px;
                                border-radius: 8px;
                                background: #18181b;
                                color: white;
                                text-decoration: none;
                            "
                        >
                            Accept invitation
                        </a>
                    </p>

                    <p style="
                        color: #71717a;
                        font-size: 14px;
                    ">
                        If you already have an AMP account,
                        sign in to accept this invitation.
                        Otherwise, create an account using
                        this email address first.
                    </p>
                </div>
            """,
        }
    )
