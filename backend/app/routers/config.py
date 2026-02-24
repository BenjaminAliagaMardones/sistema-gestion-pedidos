import os
import shutil
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.business_config import BusinessConfig
from app.schemas.business_config import BusinessConfigUpdate, BusinessConfigResponse

router = APIRouter(prefix="/api/config", tags=["Configuración"])

LOGO_DIR = "static/logos"
os.makedirs(LOGO_DIR, exist_ok=True)


def _get_or_create_config(db: Session, user_id) -> BusinessConfig:
    config = db.query(BusinessConfig).filter(BusinessConfig.user_id == user_id).first()
    if not config:
        config = BusinessConfig(user_id=user_id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/", response_model=BusinessConfigResponse)
def get_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = _get_or_create_config(db, current_user.id)
    return config


@router.put("/", response_model=BusinessConfigResponse)
def update_config(
    data: BusinessConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = _get_or_create_config(db, current_user.id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    db.commit()
    db.refresh(config)
    return config


@router.post("/logo", response_model=BusinessConfigResponse)
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes JPG, PNG o WebP")

    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"logo_{current_user.id}.{ext}"
    filepath = os.path.join(LOGO_DIR, filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    config = _get_or_create_config(db, current_user.id)
    config.logo_path = filepath
    db.commit()
    db.refresh(config)
    return config
