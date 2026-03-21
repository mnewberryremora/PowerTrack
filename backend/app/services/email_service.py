import logging
import os

import httpx

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("SMTP_FROM", "noreply@remoratechnical.com")
ADMIN_NOTIFY_EMAIL = os.environ.get("ADMIN_NOTIFY_EMAIL", "mnewberry@remoratechnical.com")


async def _send(to: str, subject: str, body: str) -> None:
    """Send an email via Resend HTTP API."""
    if not RESEND_API_KEY:
        logger.info("RESEND_API_KEY not configured, skipping email")
        return
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                json={"from": FROM_EMAIL, "to": [to], "subject": subject, "text": body},
                timeout=10,
            )
            resp.raise_for_status()
            logger.info(f"Email sent to {to}: {subject}")
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")


async def send_new_user_notification(user_email: str, display_name: str | None) -> None:
    """Notify admin when a new user registers."""
    name_part = f" ({display_name})" if display_name else ""
    await _send(
        to=ADMIN_NOTIFY_EMAIL,
        subject=f"[PowerTrack] New user pending approval: {user_email}",
        body=(
            f"New user registration pending approval:\n\n"
            f"Email: {user_email}{name_part}\n\n"
            f"Log in to your admin dashboard to approve or deny this account.\n"
            f"https://powertrack.remoratechnical.com/admin"
        ),
    )


async def send_approval_notification(user_email: str, approved: bool) -> None:
    """Notify user when their account is approved or denied."""
    if approved:
        await _send(
            to=user_email,
            subject="[PowerTrack] Your account has been approved",
            body=(
                "Your PowerTrack account has been approved.\n\n"
                "You can now log in at https://powertrack.remoratechnical.com\n\n"
                "Welcome!"
            ),
        )
    else:
        await _send(
            to=user_email,
            subject="[PowerTrack] Your account request was not approved",
            body=(
                "Unfortunately your PowerTrack account request was not approved.\n\n"
                "If you believe this is a mistake, please contact the administrator."
            ),
        )
