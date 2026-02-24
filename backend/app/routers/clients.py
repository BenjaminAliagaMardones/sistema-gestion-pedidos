from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.client import Client
from app.models.order import Order
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse

router = APIRouter(prefix="/api/clients", tags=["Clientes"])


@router.get("/", response_model=List[ClientResponse])
def list_clients(
    search: Optional[str] = Query(None, description="Buscar por nombre, teléfono o email"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Client).filter(Client.user_id == current_user.id)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Client.name.ilike(search_term)) |
            (Client.phone.ilike(search_term)) |
            (Client.email.ilike(search_term))
        )
    clients = query.order_by(Client.created_at.desc()).all()

    result = []
    for client in clients:
        orders = db.query(Order).filter(Order.client_id == client.id).all()
        total_spent = sum(o.total_usd for o in orders if o.total_usd)
        result.append(ClientResponse(
            id=client.id,
            name=client.name,
            phone=client.phone,
            email=client.email,
            address=client.address,
            created_at=client.created_at,
            total_orders=len(orders),
            total_spent_usd=round(total_spent, 2),
        ))
    return result


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = Client(
        user_id=current_user.id,
        name=data.name,
        phone=data.phone,
        email=data.email,
        address=data.address,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return ClientResponse(
        id=client.id, name=client.name, phone=client.phone,
        email=client.email, address=client.address, created_at=client.created_at,
        total_orders=0, total_spent_usd=0.0,
    )


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    orders = db.query(Order).filter(Order.client_id == client.id).all()
    total_spent = sum(o.total_usd for o in orders if o.total_usd)
    return ClientResponse(
        id=client.id, name=client.name, phone=client.phone,
        email=client.email, address=client.address, created_at=client.created_at,
        total_orders=len(orders), total_spent_usd=round(total_spent, 2),
    )


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: UUID,
    data: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    orders = db.query(Order).filter(Order.client_id == client.id).all()
    total_spent = sum(o.total_usd for o in orders if o.total_usd)
    return ClientResponse(
        id=client.id, name=client.name, phone=client.phone,
        email=client.email, address=client.address, created_at=client.created_at,
        total_orders=len(orders), total_spent_usd=round(total_spent, 2),
    )


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(Client.id == client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    db.delete(client)
    db.commit()
