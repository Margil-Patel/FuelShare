import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db
from app.models.base import Base
from app.models.user import User
from app.core.security import hash_password, create_access_token

# Create SQLite in-memory database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test function."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI TestClient with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def user_a(db_session) -> User:
    """Trip Creator User A."""
    user = User(
        name="User A (Creator)",
        email="user_a@example.com",
        password_hash=hash_password("password123"),
        phone="1111111111",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def user_b(db_session) -> User:
    """Requester User B."""
    user = User(
        name="User B (Requester)",
        email="user_b@example.com",
        password_hash=hash_password("password123"),
        phone="2222222222",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def user_c(db_session) -> User:
    """Other User C (Non-owner / Third party)."""
    user = User(
        name="User C (Third Party)",
        email="user_c@example.com",
        password_hash=hash_password("password123"),
        phone="3333333333",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def token_user_a(user_a) -> str:
    return create_access_token({"sub": str(user_a.id)})


@pytest.fixture
def token_user_b(user_b) -> str:
    return create_access_token({"sub": str(user_b.id)})


@pytest.fixture
def token_user_c(user_c) -> str:
    return create_access_token({"sub": str(user_c.id)})


@pytest.fixture
def headers_user_a(token_user_a) -> dict:
    return {"Authorization": f"Bearer {token_user_a}"}


@pytest.fixture
def headers_user_b(token_user_b) -> dict:
    return {"Authorization": f"Bearer {token_user_b}"}


@pytest.fixture
def headers_user_c(token_user_c) -> dict:
    return {"Authorization": f"Bearer {token_user_c}"}
