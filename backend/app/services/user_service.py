from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserUpdate


class UserService:
    @staticmethod
    def update_user_profile(db: Session, current_user: User, user_in: UserUpdate) -> User:
        """Updates profile details (name, phone) for the authenticated user."""
        if user_in.name is not None:
            current_user.name = user_in.name.strip()
        if user_in.phone is not None:
            current_user.phone = user_in.phone.strip()

        db.add(current_user)
        db.commit()
        db.refresh(current_user)
        return current_user
