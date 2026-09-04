import datetime
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add parent dir to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.models.base import Base
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.fuel_share import FuelShare
from app.models.join_request import JoinRequest
from app.models.payment import Payment
from app.core.security import hash_password


def seed_data():
    print("[INFO] Seeding Fuel Share demo database...")

    # Fallback to local SQLite if PostgreSQL connection fails
    try:
        engine = create_engine(settings.DATABASE_URL)
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = Session()
        # Test connection
        db.execute(Base.metadata.tables["users"].select().limit(1))
        print("[INFO] Connected to primary database.")
    except Exception:
        print("[WARN] Primary database unavailable. Falling back to local SQLite 'fuelshare_demo.db'...")
        sqlite_url = "sqlite:///./fuelshare_demo.db"
        engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = Session()

    try:
        # 1. Create Demo Users
        u1 = db.query(User).filter(User.email == "margil@fuelshare.com").first()
        if not u1:
            u1 = User(
                name="Margil Patel",
                email="margil@fuelshare.com",
                password_hash=hash_password("password123"),
                phone="+91 9876543210",
            )
            db.add(u1)

        u2 = db.query(User).filter(User.email == "rahul@fuelshare.com").first()
        if not u2:
            u2 = User(
                name="Rahul Sharma",
                email="rahul@fuelshare.com",
                password_hash=hash_password("password123"),
                phone="+91 9812345678",
            )
            db.add(u2)

        u3 = db.query(User).filter(User.email == "ananya@fuelshare.com").first()
        if not u3:
            u3 = User(
                name="Ananya Roy",
                email="ananya@fuelshare.com",
                password_hash=hash_password("password123"),
                phone="+91 9898989898",
            )
            db.add(u3)

        db.commit()
        db.refresh(u1)
        db.refresh(u2)
        db.refresh(u3)

        # 2. Add Vehicles
        v1 = db.query(Vehicle).filter(Vehicle.user_id == u1.id).first()
        if not v1:
            v1 = Vehicle(
                user_id=u1.id,
                vehicle_type="Honda City",
                fuel_type="Petrol",
                mileage=16.5,
                seating_capacity=4,
            )
            db.add(v1)

        v2 = db.query(Vehicle).filter(Vehicle.user_id == u2.id).first()
        if not v2:
            v2 = Vehicle(
                user_id=u2.id,
                vehicle_type="Hyundai i20",
                fuel_type="Petrol",
                mileage=17.2,
                seating_capacity=4,
            )
            db.add(v2)

        db.commit()

        # 3. Create Realistic Fuel Share Offers
        tomorrow = datetime.date.today() + datetime.timedelta(days=1)
        day_after = datetime.date.today() + datetime.timedelta(days=2)

        t1 = db.query(FuelShare).filter(FuelShare.source_name == "Ahmedabad Junction").first()
        if not t1:
            t1 = FuelShare(
                creator_id=u1.id,
                source_name="Ahmedabad Junction",
                source_latitude=23.0225,
                source_longitude=72.5714,
                destination_name="Gandhinagar Bus Station",
                destination_latitude=23.2156,
                destination_longitude=72.6369,
                departure_date=tomorrow,
                departure_time=datetime.time(9, 0),
                available_seats=2,
                estimated_distance=28.5,
                estimated_fuel_cost=250.0,
                status="ACTIVE",
            )
            db.add(t1)
        else:
            t1.departure_date = tomorrow

        t2 = db.query(FuelShare).filter(FuelShare.source_name == "ISKCON Cross Road, Ahmedabad").first()
        if not t2:
            t2 = FuelShare(
                creator_id=u2.id,
                source_name="ISKCON Cross Road, Ahmedabad",
                source_latitude=23.0276,
                source_longitude=72.5074,
                destination_name="Anand Railway Station",
                destination_latitude=22.5645,
                destination_longitude=72.9289,
                departure_date=tomorrow,
                departure_time=datetime.time(8, 30),
                available_seats=3,
                estimated_distance=72.0,
                estimated_fuel_cost=550.0,
                status="ACTIVE",
            )
            db.add(t2)
        else:
            t2.departure_date = tomorrow

        t3 = db.query(FuelShare).filter(FuelShare.source_name == "Bopal, Ahmedabad").first()
        if not t3:
            t3 = FuelShare(
                creator_id=u1.id,
                source_name="Bopal, Ahmedabad",
                source_latitude=23.0336,
                source_longitude=72.4634,
                destination_name="GIFT City, Gandhinagar",
                destination_latitude=23.1611,
                destination_longitude=72.6841,
                departure_date=day_after,
                departure_time=datetime.time(9, 15),
                available_seats=1,
                estimated_distance=35.0,
                estimated_fuel_cost=320.0,
                status="ACTIVE",
            )
            db.add(t3)
        else:
            t3.departure_date = day_after

        db.commit()
        if t1: db.refresh(t1)

        # 4. Create Accepted Join Request and Payment
        if t1:
            req = (
                db.query(JoinRequest)
                .filter(JoinRequest.fuel_share_id == t1.id, JoinRequest.user_id == u2.id)
                .first()
            )
            if not req:
                req = JoinRequest(
                    fuel_share_id=t1.id,
                    user_id=u2.id,
                    status="ACCEPTED",
                    accepted_at=datetime.datetime.now(datetime.timezone.utc),
                )
                db.add(req)
                t1.available_seats = max(0, t1.available_seats - 1)

            pay = (
                db.query(Payment)
                .filter(Payment.fuel_share_id == t1.id, Payment.user_id == u2.id)
                .first()
            )
            if not pay:
                pay = Payment(
                    user_id=u2.id,
                    fuel_share_id=t1.id,
                    amount=125.0,
                    razorpay_order_id="order_demo_1001",
                    razorpay_payment_id="pay_demo_2001",
                    status="SUCCESS",
                )
                db.add(pay)

            db.commit()

        print("[SUCCESS] Demo data seeded successfully!")
        print("Demo Credentials:")
        print("1. User 1: margil@fuelshare.com / password123")
        print("2. User 2: rahul@fuelshare.com / password123")
        print("3. User 3: ananya@fuelshare.com / password123")

    except Exception as e:
        print(f"[ERROR] Error seeding demo data: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
