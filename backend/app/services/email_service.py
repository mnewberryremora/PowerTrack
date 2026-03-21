import logging
import os

logger = logging.getLogger(__name__)

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "noreply@powertrac.app")
ADMIN_NOTIFY_EMAIL = os.environ.get("ADMIN_NOTIFY_EMAIL", "mnewberry@remoratechnical.com")


async def send_approval_notification(user_email: str, approved: bool) -> None:
    """Send email to user when their account is approved or denied."""
    if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD:
        return
    try:
        import aiosmtplib
        from email.mime.text import MIMEText
        if approved:
            subject = "[PowerTrack] Your account has been approved"
            body = (
                "Your PowerTrack account has been approved.\n\n"
                f"You can now log in at https://powertrack.remoratechnical.com\n\n"
                "Welcome!"
            )
        else:
            subject = "[PowerTrack] Your account request was not approved"
            body = (
                "Unfortunately your PowerTrack account request was not approved.\n\n"
                "If you believe this is a mistake, please contact the administrator."
            )
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = user_email
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USERNAME,
            password=SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info(f"Approval notification sent to {user_email}: approved={approved}")
    except Exception as e:
        logger.error(f"Failed to send approval notification: {e}")


async def send_new_user_notification(user_email: str, display_name: str | None) -> None:
    """Send email to admin when a new user registers. Silently skips if SMTP not configured."""
    if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.info("SMTP not configured, skipping admin notification email")
        return
    try:
        import aiosmtplib
        from email.mime.text import MIMEText
        name_part = f" ({display_name})" if display_name else ""
        msg = MIMEText(
            f"New user registration pending approval:\n\nEmail: {user_email}{name_part}\n\n"
            f"Log in to your admin dashboard to approve or deny this account."
        )
        msg["Subject"] = f"[PowerTrack] New user pending approval: {user_email}"
        msg["From"] = SMTP_FROM
        msg["To"] = ADMIN_NOTIFY_EMAIL
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USERNAME,
            password=SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info(f"Admin notification sent for new user: {user_email}")
    except Exception as e:
        logger.error(f"Failed to send admin notification email: {e}")
