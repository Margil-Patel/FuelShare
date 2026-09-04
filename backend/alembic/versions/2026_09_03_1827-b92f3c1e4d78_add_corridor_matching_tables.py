"""Add corridor matching tables and route_polyline column

Revision ID: b92f3c1e4d78
Revises: a16851ebb912
Create Date: 2026-09-03 18:27:00.000000

Adds:
- ``route_polyline`` column to ``fuel_shares`` table
- New ``ride_requests`` table  (passenger's corridor match request)
- New ``corridor_matches`` table (proposed/accepted ride+request links)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'b92f3c1e4d78'
down_revision: Union[str, None] = 'a16851ebb912'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Add route_polyline to fuel_shares (nullable — backfilled lazily)
    # ------------------------------------------------------------------
    op.add_column(
        'fuel_shares',
        sa.Column('route_polyline', sa.String(length=65535), nullable=True,
                  comment='OSRM-encoded polyline for the driving route A→B'),
    )

    # ------------------------------------------------------------------
    # 2. ride_requests table
    # ------------------------------------------------------------------
    op.create_table(
        'ride_requests',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('passenger_id', sa.Integer(), nullable=False),

        # Pickup point C
        sa.Column('pickup_name', sa.String(length=255), nullable=False),
        sa.Column('pickup_latitude', sa.Float(), nullable=False),
        sa.Column('pickup_longitude', sa.Float(), nullable=False),

        # Drop point D
        sa.Column('drop_name', sa.String(length=255), nullable=False),
        sa.Column('drop_latitude', sa.Float(), nullable=False),
        sa.Column('drop_longitude', sa.Float(), nullable=False),

        sa.Column('desired_departure', sa.DateTime(timezone=False), nullable=False),
        sa.Column('seats_needed', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),

        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),

        sa.ForeignKeyConstraint(['passenger_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ride_requests_id'), 'ride_requests', ['id'], unique=False)
    op.create_index(op.f('ix_ride_requests_passenger_id'), 'ride_requests', ['passenger_id'], unique=False)

    # ------------------------------------------------------------------
    # 3. corridor_matches table
    # ------------------------------------------------------------------
    op.create_table(
        'corridor_matches',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('fuel_share_id', sa.Integer(), nullable=False),
        sa.Column('ride_request_id', sa.Integer(), nullable=False),

        # Corridor metrics
        sa.Column('detour_distance_m', sa.Float(), nullable=False),
        sa.Column('pickup_buffer_m', sa.Float(), nullable=False),
        sa.Column('drop_buffer_m', sa.Float(), nullable=False),
        sa.Column('pickup_fraction', sa.Float(), nullable=False),
        sa.Column('drop_fraction', sa.Float(), nullable=False),

        # Fare
        sa.Column('fare_estimate', sa.Float(), nullable=False),
        sa.Column('fare_strategy', sa.String(length=20), nullable=False),

        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),

        sa.ForeignKeyConstraint(['fuel_share_id'], ['fuel_shares.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ride_request_id'], ['ride_requests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_corridor_matches_id'), 'corridor_matches', ['id'], unique=False)
    op.create_index(op.f('ix_corridor_matches_fuel_share_id'), 'corridor_matches', ['fuel_share_id'], unique=False)
    op.create_index(op.f('ix_corridor_matches_ride_request_id'), 'corridor_matches', ['ride_request_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_corridor_matches_ride_request_id'), table_name='corridor_matches')
    op.drop_index(op.f('ix_corridor_matches_fuel_share_id'), table_name='corridor_matches')
    op.drop_index(op.f('ix_corridor_matches_id'), table_name='corridor_matches')
    op.drop_table('corridor_matches')

    op.drop_index(op.f('ix_ride_requests_passenger_id'), table_name='ride_requests')
    op.drop_index(op.f('ix_ride_requests_id'), table_name='ride_requests')
    op.drop_table('ride_requests')

    op.drop_column('fuel_shares', 'route_polyline')
