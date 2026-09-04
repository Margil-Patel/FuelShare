from pydantic import BaseModel, ConfigDict


class RootResponse(BaseModel):
    message: str
    app_name: str
    environment: str
    version: str = "1.0.0"

    model_config = ConfigDict(from_attributes=True)


class DatabaseHealth(BaseModel):
    connected: bool
    details: str


class HealthCheckResponse(BaseModel):
    status: str
    app_name: str
    environment: str
    database: DatabaseHealth

    model_config = ConfigDict(from_attributes=True)
