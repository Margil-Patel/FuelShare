from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Fuel Share"
    APP_ENV: str = "development"
    DATABASE_URL: str = "sqlite:///./fuelshare.db"

    # JWT Settings
    JWT_SECRET_KEY: str = "fuelshare_secret_key_change_in_production_2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Matching Engine Settings
    MATCH_THRESHOLD: int = 60

    # Corridor Matching Settings (tunable via .env)
    CORRIDOR_BUFFER_M: int = 500            # Max distance (m) from route for pickup/drop to match
    CORRIDOR_DETOUR_MAX_KM: float = 2.0     # Max allowed absolute detour in km
    CORRIDOR_DETOUR_MAX_PCT: float = 0.15   # Max allowed proportional detour (15%)
    CORRIDOR_TIME_WINDOW_MINUTES: int = 30  # ±minutes time window for matching
    FARE_SPLIT_STRATEGY: str = "proportional"  # "proportional" or "even"

    # Fuel Calculation Settings
    DEFAULT_FUEL_PRICE: float = 100.0

    # Razorpay Payment Settings
    RAZORPAY_KEY_ID: str = "rzp_test_fuelshare123"
    RAZORPAY_KEY_SECRET: str = "rzp_test_secret_key_456"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
