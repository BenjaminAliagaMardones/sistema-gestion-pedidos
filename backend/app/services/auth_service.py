from datetime import datetime, timedelta
from typing import Optional
import jwt
import bcrypt
from sqlalchemy.orm import Session
from app.config import settings
from app.models.user import User


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_admin_if_not_exists(db: Session):
    """Crea el usuario administrador si no existe."""
    existing = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
    if not existing:
        admin = User(
            username=settings.ADMIN_USERNAME,
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            is_active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        return admin
    return existing
