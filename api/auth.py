"""OTP authentication and session management"""
import secrets
import hashlib
import hmac
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict
from fastapi import HTTPException, status
from config import settings
from models import OTPRequest, OTPVerify, SessionResponse
from email_service import send_otp_email


# In-memory storage for OTPs (in production, use Redis)
_otp_storage: Dict[str, Dict] = {}
_session_storage: Dict[str, Dict] = {}


def generate_otp() -> str:
    """Generate a 6-digit OTP"""
    return f"{secrets.randbelow(1000000):06d}"


def hash_otp(otp: str) -> str:
    """Hash OTP for storage"""
    return hashlib.sha256(
        f"{otp}{settings.OTP_SECRET_KEY}".encode()
    ).hexdigest()


def generate_session_token() -> str:
    """Generate a secure session token"""
    return secrets.token_urlsafe(32)


async def request_otp(email: str) -> bool:
    """
    Request OTP for email authentication
    
    Args:
        email: Email address to send OTP to
        
    Returns:
        True if OTP was sent successfully
        
    Raises:
        HTTPException: If email is not allowed or rate limit exceeded
    """
    # Import here to avoid circular imports
    from buildmaster_ops import is_email_valid, load_valid_emails
    
    # Validate email against valid emails list
    valid_emails = await load_valid_emails()
    
    # Fallback to config ALLOWED_EMAIL if no valid emails are configured
    if not valid_emails:
        if email.lower() != settings.ALLOWED_EMAIL.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not authorized"
            )
    else:
        if not await is_email_valid(email):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not authorized"
            )
    
    # Rate limiting check
    email_key = email.lower()
    now = datetime.utcnow()
    
    # Clean expired OTPs
    expired_keys = [
        k for k, v in _otp_storage.items()
        if (now - v["created_at"]).total_seconds() > settings.OTP_EXPIRY_MINUTES * 60
    ]
    for k in expired_keys:
        del _otp_storage[k]
    
    # Check rate limit
    recent_requests = [
        v for k, v in _otp_storage.items()
        if k.startswith(email_key) and
        (now - v["created_at"]).total_seconds() < 900  # 15 minutes
    ]
    
    if len(recent_requests) >= settings.OTP_RATE_LIMIT_PER_15MIN:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests. Please wait 15 minutes."
        )
    
    # Generate OTP
    otp = generate_otp()
    otp_hash = hash_otp(otp)
    expires_at = now + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
    
    # Store OTP
    otp_key = f"{email_key}:{otp_hash}"
    _otp_storage[otp_key] = {
        "email": email.lower(),
        "otp_hash": otp_hash,
        "created_at": now,
        "expires_at": expires_at,
        "verified": False
    }
    
    # Send OTP email
    try:
        await send_otp_email(email, otp)
        return True
    except Exception as e:
        # Remove OTP if email failed
        if otp_key in _otp_storage:
            del _otp_storage[otp_key]
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send OTP email: {str(e)}"
        )


async def verify_otp(email: str, otp_code: str) -> SessionResponse:
    """
    Verify OTP and create session
    
    Args:
        email: Email address
        otp_code: OTP code to verify
        
    Returns:
        SessionResponse with session token and expiry
        
    Raises:
        HTTPException: If OTP is invalid or expired
    """
    # Import here to avoid circular imports
    from buildmaster_ops import is_email_valid, load_valid_emails
    
    # Validate email against valid emails list
    valid_emails = await load_valid_emails()
    
    # Fallback to config ALLOWED_EMAIL if no valid emails are configured
    if not valid_emails:
        if email.lower() != settings.ALLOWED_EMAIL.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not authorized"
            )
    else:
        if not await is_email_valid(email):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not authorized"
            )
    
    # Hash provided OTP
    otp_hash = hash_otp(otp_code)
    email_key = email.lower()
    now = datetime.utcnow()
    
    # Find matching OTP
    otp_key = None
    for key, value in _otp_storage.items():
        if key.startswith(email_key) and value["otp_hash"] == otp_hash:
            otp_key = key
            break
    
    if not otp_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP code"
        )
    
    otp_data = _otp_storage[otp_key]
    
    # Check if expired
    if now > otp_data["expires_at"]:
        del _otp_storage[otp_key]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP code has expired"
        )
    
    # Check if already used
    if otp_data["verified"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP code already used"
        )
    
    # Mark as verified and remove
    otp_data["verified"] = True
    del _otp_storage[otp_key]
    
    # Create session
    session_token = generate_session_token()
    expires_at = now + timedelta(hours=settings.SESSION_EXPIRY_HOURS)
    
    _session_storage[session_token] = {
        "email": email.lower(),
        "created_at": now,
        "expires_at": expires_at
    }
    
    return SessionResponse(
        session_token=session_token,
        expires_at=expires_at
    )


def verify_session(session_token: str) -> Optional[str]:
    """
    Verify session token and return email if valid
    
    Args:
        session_token: Session token to verify
        
    Returns:
        Email address if valid, None otherwise
    """
    if not session_token:
        return None
    
    if session_token not in _session_storage:
        return None
    
    session_data = _session_storage[session_token]
    now = datetime.utcnow()
    
    # Check if expired
    if now > session_data["expires_at"]:
        del _session_storage[session_token]
        return None
    
    return session_data["email"]


def cleanup_expired_sessions():
    """Clean up expired sessions (call periodically)"""
    now = datetime.utcnow()
    expired_tokens = [
        token for token, data in _session_storage.items()
        if now > data["expires_at"]
    ]
    for token in expired_tokens:
        del _session_storage[token]

