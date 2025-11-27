"""Email service for sending OTP and build notifications"""
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from config import settings
import os
import socket


async def get_smtp_config():
    """
    Load SMTP configuration from environment or site_settings
    Falls back to local Postfix if not configured
    """
    # Try to read from environment first
    host = os.getenv("SMTP_HOST", settings.SMTP_HOST)
    port = int(os.getenv("SMTP_PORT", settings.SMTP_PORT))
    secure = os.getenv("SMTP_SECURE", "false").lower() == "true"
    user = os.getenv("SMTP_USER", settings.SMTP_USER)
    password = os.getenv("SMTP_PASS", settings.SMTP_PASS)
    from_email = os.getenv("SMTP_FROM_EMAIL", settings.SMTP_FROM_EMAIL)
    from_name = os.getenv("SMTP_FROM_NAME", settings.SMTP_FROM_NAME)
    
    # TODO: Load from site_settings database if available
    # For now, use environment variables or defaults
    
    return {
        "host": host,
        "port": port,
        "secure": secure,
        "user": user,
        "password": password,
        "from_email": from_email,
        "from_name": from_name
    }


async def send_email(
    to: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None
) -> bool:
    """
    Send email using SMTP
    
    Args:
        to: Recipient email address
        subject: Email subject
        html_body: HTML email body
        text_body: Plain text email body (optional)
        
    Returns:
        True if sent successfully
    """
    smtp_config = await get_smtp_config()
    
    # Create message
    message = MIMEMultipart("alternative")
    message["From"] = f"{smtp_config['from_name']} <{smtp_config['from_email']}>"
    message["To"] = to
    message["Subject"] = subject
    
    # Add text and HTML parts
    if text_body:
        message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))
    
    try:
        # Force IPv4 by ensuring we use 127.0.0.1 instead of localhost
        hostname = smtp_config["host"]
        if hostname == "localhost":
            hostname = "127.0.0.1"
        
        # Use simple send with explicit IPv4 address
        if smtp_config["secure"]:
            await aiosmtplib.send(
                message,
                hostname=hostname,
                port=smtp_config["port"],
                username=smtp_config["user"] if smtp_config["user"] else None,
                password=smtp_config["password"] if smtp_config["password"] else None,
                use_tls=True
            )
        else:
            await aiosmtplib.send(
                message,
                hostname=hostname,
                port=smtp_config["port"],
                username=smtp_config["user"] if smtp_config["user"] else None,
                password=smtp_config["password"] if smtp_config["password"] else None,
                use_tls=False,
                start_tls=False
            )
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise


async def send_otp_email(email: str, otp_code: str) -> bool:
    """Send OTP email"""
    subject = "Build Dashboard - OTP Code"
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>Build Dashboard OTP</h2>
        <p>Your OTP code is:</p>
        <h1 style="font-size: 32px; letter-spacing: 8px; color: #2563eb; margin: 20px 0;">
            {otp_code}
        </h1>
        <p>This code will expire in {settings.OTP_EXPIRY_MINUTES} minutes.</p>
        <p style="color: #666; font-size: 12px;">
            If you didn't request this code, please ignore this email.
        </p>
    </body>
    </html>
    """
    text_body = f"""
    Build Dashboard OTP
    
    Your OTP code is: {otp_code}
    
    This code will expire in {settings.OTP_EXPIRY_MINUTES} minutes.
    
    If you didn't request this code, please ignore this email.
    """
    
    return await send_email(email, subject, html_body, text_body)


async def send_build_started_email(build_id: str, config: dict) -> bool:
    """Send build started notification"""
    subject = f"Build Started - {build_id[:8]}"
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>Build Started</h2>
        <p><strong>Build ID:</strong> {build_id}</p>
        <p><strong>Mode:</strong> {config.get('build_mode', 'full')}</p>
        <p><strong>Workers:</strong> {config.get('workers', 'auto')}</p>
        <p>You will receive another email when the build completes.</p>
    </body>
    </html>
    """
    
    return await send_email(
        settings.ALLOWED_EMAIL,
        subject,
        html_body
    )


async def send_build_completed_email(build_id: str, success: bool, message: str, error: Optional[str] = None) -> bool:
    """Send build completion notification"""
    status = "Success" if success else "Failed"
    color = "#10b981" if success else "#ef4444"
    
    subject = f"Build {status} - {build_id[:8]}"
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: {color};">Build {status}</h2>
        <p><strong>Build ID:</strong> {build_id}</p>
        <p><strong>Status:</strong> <span style="color: {color}; font-weight: bold;">{status}</span></p>
        <p><strong>Message:</strong> {message}</p>
        {f'<p><strong>Error:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">{error}</code></p>' if error else ''}
        <p>View details at: https://build.dintrafikskolahlm.se</p>
    </body>
    </html>
    """
    
    return await send_email(
        settings.ALLOWED_EMAIL,
        subject,
        html_body
    )


async def send_build_stalled_email(build_id: str, last_output: str) -> bool:
    """Send build stalled notification"""
    subject = f"Build Stalled - {build_id[:8]}"
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #f59e0b;">Build Stalled</h2>
        <p><strong>Build ID:</strong> {build_id}</p>
        <p>The build appears to have stalled with no output for an extended period.</p>
        <p><strong>Last Output:</strong></p>
        <pre style="background: #f3f4f6; padding: 12px; border-radius: 4px; overflow-x: auto;">{last_output[-500:]}</pre>
        <p>Please check the build logs at: https://build.dintrafikskolahlm.se</p>
    </body>
    </html>
    """
    
    return await send_email(
        settings.ALLOWED_EMAIL,
        subject,
        html_body
    )

